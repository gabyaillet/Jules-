// Tests de handler.ts avec un faux client Anthropic et une fausse base Supabase.
// Lancer depuis la racine du dépôt :
//   deno test --node-modules-dir=none supabase/functions/verify-photo/

import { strict as assert } from "node:assert";
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import {
  createHandler,
  type DbResult,
  type HandlerDeps,
  interpretResponse,
  MAX_BODY_BYTES,
  MODEL,
  parseAllowedOrigins,
  parseLimit,
  sniffMediaType,
  SYSTEM_PROMPT,
  VERDICT_SCHEMA,
} from "./handler.ts";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

const ORIGIN = "https://gabyaillet.github.io";
const PID = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.tourist.token";
const VOUCHER = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: USER,
  participation_id: PID,
  mission_id: "44444444-4444-4444-8444-444444444444",
  code: "MLZ-B-K7Q2",
  reward_title: "Aller-retour au téléphérique du Mont Bochor",
  reward_partner: "Téléphérique du Mont Bochor",
  reward_category: "Expérience",
  created_at: "2026-10-14T08:00:00Z",
  used_at: null,
};

// ---------------------------------------------------------------------------
// Doublures
// ---------------------------------------------------------------------------
function imageB64(kind: "jpeg" | "png" | "webp" | "junk" = "jpeg", size = 300): string {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 7 + 3) % 251;
  if (kind === "jpeg") bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  if (kind === "png") bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (kind === "webp") {
    bytes.set([0x52, 0x49, 0x46, 0x46]);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  }
  if (kind === "junk") bytes.set([0x00, 0x01, 0x02, 0x03]);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
const IMAGE = imageB64("jpeg");

type RpcImpl = (args: Record<string, unknown>) => DbResult;

class FakeDb {
  calls: { fn: string; args: Record<string, unknown> }[] = [];
  impl: Record<string, RpcImpl>;
  constructor(overrides: Record<string, RpcImpl> = {}) {
    this.impl = {
      begin_photo_check: () => ({
        data: {
          ok: true,
          check_id: 7,
          title: "Nettoyer les sentiers avec les gardes du Parc",
          photo_hint: "Les déchets que vous avez ramassés sur le sentier.",
          attempts: 1,
          max_attempts: 5,
        },
        error: null,
      }),
      finish_photo_check: () => ({ data: null, error: null }),
      release_photo_check: () => ({ data: null, error: null }),
      complete_participation: () => ({ data: { ...VOUCHER }, error: null }),
      ...overrides,
    };
  }
  rpc(fn: string, args: Record<string, unknown> = {}): Promise<DbResult> {
    this.calls.push({ fn, args });
    const impl = this.impl[fn];
    if (!impl) throw new Error("rpc inattendu : " + fn);
    return Promise.resolve(impl(args));
  }
  count(fn: string) {
    return this.calls.filter((c) => c.fn === fn).length;
  }
  args(fn: string) {
    return this.calls.find((c) => c.fn === fn)?.args;
  }
}

function message(text: string | null, extra: Record<string, unknown> = {}): BetaMessage {
  const content: unknown[] = [{ type: "thinking", thinking: "", signature: "sig" }];
  if (text !== null) content.push({ type: "text", text, citations: null });
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: MODEL,
    content,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1500, output_tokens: 120 },
    ...extra,
  } as unknown as BetaMessage;
}

function fakeAnthropic(impl: (p: Params) => BetaMessage | Promise<BetaMessage>) {
  const calls: Params[] = [];
  return {
    calls,
    client: {
      beta: {
        messages: {
          create(params: Params): Promise<BetaMessage> {
            calls.push(params);
            return Promise.resolve().then(() => impl(params));
          },
        },
      },
    },
  };
}

const verdictText = (valid: boolean, confidence: number, reason: string) => JSON.stringify({ valid, confidence, reason });

function setup(opts: {
  anthropic?: (p: Params) => BetaMessage | Promise<BetaMessage>;
  db?: Record<string, RpcImpl>;
  user?: { id: string } | null | "throw";
  noAnthropic?: boolean;
  globalDailyLimit?: number;
} = {}) {
  const db = new FakeDb(opts.db);
  const ai = fakeAnthropic(opts.anthropic ?? (() => message(verdictText(true, 0.92, "Merci, on voit bien les déchets ramassés."))));
  const tokens: string[] = [];
  const logs: unknown[] = [];
  const deps: HandlerDeps = {
    anthropic: opts.noAnthropic ? null : ai.client,
    db,
    getUser(token) {
      tokens.push(token);
      if (opts.user === "throw") return Promise.reject(new Error("réseau"));
      return Promise.resolve(opts.user === undefined ? { id: USER } : opts.user);
    },
    allowedOrigins: [ORIGIN],
    globalDailyLimit: opts.globalDailyLimit,
    now: () => new Date("2026-10-14T09:30:00Z"),
    log: (event, details) => logs.push({ event, ...details }),
  };
  return { handler: createHandler(deps), db, ai, tokens, logs };
}

function post(
  body: unknown,
  opts: { origin?: string | null; auth?: string | null; raw?: string; headers?: Record<string, string> } = {},
) {
  const headers = new Headers({ "content-type": "application/json", ...(opts.headers ?? {}) });
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin) headers.set("origin", origin);
  const auth = opts.auth === undefined ? "Bearer " + TOKEN : opts.auth;
  if (auth) headers.set("authorization", auth);
  return new Request("https://projet.supabase.co/functions/v1/verify-photo", {
    method: "POST",
    headers,
    body: opts.raw ?? JSON.stringify(body),
  });
}

const goodBody = (over: Record<string, unknown> = {}) => ({
  participationId: PID,
  image: IMAGE,
  mediaType: "image/jpeg",
  ...over,
});

async function call(handler: (r: Request) => Promise<Response>, req: Request) {
  const res = await handler(req);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { _raw: text };
  }
  return { res, body };
}

// ---------------------------------------------------------------------------
// CORS / méthode
// ---------------------------------------------------------------------------
Deno.test("OPTIONS depuis une origine autorisée : 204 + en-têtes CORS", async () => {
  const { handler, db, ai } = setup();
  const res = await handler(new Request("https://x/verify-photo", { method: "OPTIONS", headers: { origin: ORIGIN } }));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  const allowed = res.headers.get("access-control-allow-headers") ?? "";
  for (const h of ["authorization", "x-client-info", "apikey", "content-type"]) assert.ok(allowed.includes(h), h);
  assert.ok((res.headers.get("access-control-allow-methods") ?? "").includes("POST"));
  assert.equal(res.headers.get("vary"), "Origin");
  assert.equal(db.calls.length, 0);
  assert.equal(ai.calls.length, 0);
});

Deno.test("OPTIONS depuis une autre origine : 403 sans Access-Control-Allow-Origin", async () => {
  const { handler } = setup();
  const res = await handler(new Request("https://x/verify-photo", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

Deno.test("POST depuis une autre origine : 403, rien n'est appelé", async () => {
  const { handler, db, ai, tokens } = setup();
  const { res, body } = await call(handler, post(goodBody(), { origin: "https://evil.example" }));
  assert.equal(res.status, 403);
  assert.equal(body.error, "origin_not_allowed");
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(db.calls.length + ai.calls.length + tokens.length, 0);
});

Deno.test("GET : 405 avec Allow et CORS", async () => {
  const { handler } = setup();
  const { res, body } = await call(handler, new Request("https://x/verify-photo", { method: "GET", headers: { origin: ORIGIN } }));
  assert.equal(res.status, 405);
  assert.equal(body.error, "method_not_allowed");
  assert.equal(res.headers.get("allow"), "POST, OPTIONS");
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
});

// ---------------------------------------------------------------------------
// Taille et validation
// ---------------------------------------------------------------------------
Deno.test("corps trop gros (Content-Length annoncé) : 413", async () => {
  const { handler, db } = setup();
  const { res, body } = await call(handler, post(null, { raw: "{}", headers: { "content-length": String(MAX_BODY_BYTES + 1) } }));
  assert.equal(res.status, 413);
  assert.equal(body.error, "payload_too_large");
  assert.equal(db.calls.length, 0);
});

Deno.test("corps trop gros (lu en flux, sans Content-Length) : 413", async () => {
  const { handler, db, ai } = setup();
  const big = JSON.stringify(goodBody({ image: "A".repeat(MAX_BODY_BYTES) }));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(big);
      for (let i = 0; i < bytes.length; i += 65536) controller.enqueue(bytes.slice(i, i + 65536));
      controller.close();
    },
  });
  const req = new Request("https://x/verify-photo", {
    method: "POST",
    headers: { origin: ORIGIN, authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: stream,
  });
  assert.equal(req.headers.get("content-length"), null);
  const { res } = await call(handler, req);
  assert.equal(res.status, 413);
  assert.equal(db.calls.length + ai.calls.length, 0);
});

Deno.test("JSON invalide ou champs manquants : 400", async () => {
  const { handler } = setup();
  for (const req of [
    post(null, { raw: "{pas du json" }),
    post(null, { raw: "[]" }),
    post(goodBody({ participationId: undefined })),
    post(goodBody({ participationId: "pas-un-uuid" })),
  ]) {
    const { res, body } = await call(handler, req);
    assert.equal(res.status, 400);
    assert.equal(body.error, "bad_request");
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  }
});

Deno.test("image invalide (type, base64, taille, format) : 400 bad_image, sans appel à Claude", async () => {
  const { handler, ai, db, tokens } = setup();
  for (const over of [
    { mediaType: "image/gif" },
    { mediaType: undefined },
    { image: 42 },
    { image: "%%%%pas-du-base64%%%%" },
    { image: IMAGE.slice(0, -1) }, // longueur non multiple de 4
    { image: btoa("\xff\xd8\xff tiny") }, // trop petite
    { image: imageB64("junk") }, // ni JPEG, ni PNG, ni WebP
    { image: "" },
  ]) {
    const { res, body } = await call(handler, post(goodBody(over)));
    assert.equal(res.status, 400, JSON.stringify(over).slice(0, 60));
    assert.equal(body.error, "bad_image");
  }
  assert.equal(ai.calls.length + db.calls.length + tokens.length, 0);
});

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------
Deno.test("sans jeton, jeton refusé ou erreur de lecture : 401", async () => {
  for (const variant of [
    { auth: null, user: undefined },
    { auth: "Basic abc", user: undefined },
    { auth: undefined, user: null },
    { auth: undefined, user: "throw" as const },
  ]) {
    const { handler, db, ai } = setup({ user: variant.user });
    const { res, body } = await call(handler, post(goodBody(), { auth: variant.auth }));
    assert.equal(res.status, 401);
    assert.equal(body.error, "unauthorized");
    assert.equal(db.calls.length + ai.calls.length, 0);
  }
});

Deno.test("le jeton Bearer est transmis tel quel à getUser", async () => {
  const { handler, tokens } = setup();
  await call(handler, post(goodBody()));
  assert.deepEqual(tokens, [TOKEN]);
});

Deno.test("clé Anthropic absente : 500 config_error, aucun essai réservé", async () => {
  const { handler, db } = setup({ noAnthropic: true });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 500);
  assert.equal(body.error, "config_error");
  assert.equal(db.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Réservation (begin_photo_check)
// ---------------------------------------------------------------------------
const refusals: [string, number, string][] = [
  ["not_found", 404, "not_found"],
  ["already_validated", 409, "already_validated"],
  ["attempts_exhausted", 422, "attempts_exhausted"],
  ["rate_limited", 429, "rate_limited"],
  ["global_limit", 503, "busy"],
  ["mission_inactive", 410, "mission_inactive"],
];
for (const [dbError, status, code] of refusals) {
  Deno.test(`réservation refusée « ${dbError} » : ${status}, Claude n'est pas appelé`, async () => {
    const { handler, db, ai } = setup({
      db: { begin_photo_check: () => ({ data: { ok: false, error: dbError }, error: null }) },
    });
    const { res, body } = await call(handler, post(goodBody()));
    assert.equal(res.status, status);
    assert.equal(body.error, code);
    assert.equal(typeof body.message, "string");
    assert.equal(ai.calls.length, 0);
    assert.equal(db.count("complete_participation") + db.count("finish_photo_check") + db.count("release_photo_check"), 0);
    if (status === 429) assert.ok(res.headers.get("retry-after"));
  });
}

Deno.test("réservation : arguments transmis (utilisateur du jeton, limites 5 / 20 / globale)", async () => {
  const { handler, db } = setup({ globalDailyLimit: 321 });
  await call(handler, post(goodBody()));
  assert.deepEqual(db.args("begin_photo_check"), {
    p_participation: PID,
    p_user: USER,
    p_max_attempts: 5,
    p_user_daily_limit: 20,
    p_global_daily_limit: 321,
  });
});

Deno.test("erreur de base pendant la réservation : 500", async () => {
  const { handler, ai } = setup({
    db: { begin_photo_check: () => ({ data: null, error: { message: "boom", code: "XX000" } }) },
  });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 500);
  assert.equal(body.error, "internal_error");
  assert.equal(ai.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Appel à Claude
// ---------------------------------------------------------------------------
Deno.test("requête Claude : forme exacte (modèle, effort, schéma, repli, image, consigne)", async () => {
  const { handler, ai } = setup();
  await call(handler, post(goodBody()));
  assert.equal(ai.calls.length, 1);
  const p = ai.calls[0] as unknown as Record<string, unknown>;
  assert.equal(p.model, "claude-opus-5-5");
  assert.equal(p.max_tokens, 2048);
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.output_config, { effort: "low", format: { type: "json_schema", schema: VERDICT_SCHEMA } });
  assert.equal(p.system, SYSTEM_PROMPT);
  for (const forbidden of ["thinking", "output_format", "tool_choice", "tools", "temperature", "stream"]) {
    assert.ok(!(forbidden in p), forbidden + " ne doit pas être envoyé");
  }
  const messages = p.messages as { role: string; content: Record<string, unknown>[] }[];
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, "user");
  assert.deepEqual(messages[0].content[0], {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: IMAGE },
  });
  assert.deepEqual(messages[0].content[1], {
    type: "text",
    text: "Mission : Nettoyer les sentiers avec les gardes du Parc\nLa photo doit montrer : Les déchets que vous avez ramassés sur le sentier.",
  });
  assert.deepEqual(VERDICT_SCHEMA, {
    type: "object",
    properties: { valid: { type: "boolean" }, confidence: { type: "number" }, reason: { type: "string" } },
    required: ["valid", "confidence", "reason"],
    additionalProperties: false,
  });
});

Deno.test("préfixe data: accepté ; le vrai format de l'image prime sur celui annoncé", async () => {
  const png = imageB64("png");
  const { handler, ai } = setup();
  const { res } = await call(handler, post(goodBody({ image: "data:image/jpeg;base64," + png, mediaType: "image/jpeg" })));
  assert.equal(res.status, 200);
  const block = (ai.calls[0].messages[0].content as unknown as Record<string, Record<string, unknown>>[])[0];
  assert.equal(block.source.media_type, "image/png");
  assert.equal(block.source.data, png);
});

Deno.test("photo valide : 200, bon émis, complete_participation appelé une seule fois", async () => {
  const { handler, db } = setup();
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(body.valid, true);
  assert.equal(body.confidence, 0.92);
  assert.equal(body.reason, "Merci, on voit bien les déchets ramassés.");
  assert.deepEqual(body.voucher, VOUCHER);
  assert.equal(db.count("complete_participation"), 1);
  const args = db.args("complete_participation")!;
  assert.equal(args.p_participation, PID);
  assert.deepEqual(args.p_verdict, {
    valid: true,
    confidence: 0.92,
    reason: "Merci, on voit bien les déchets ramassés.",
    checked_at: "2026-10-14T09:30:00.000Z",
  });
  assert.equal(db.count("finish_photo_check"), 1);
  assert.equal(db.args("finish_photo_check")!.p_valid, true);
  assert.equal(db.args("finish_photo_check")!.p_check, 7);
  assert.equal(db.count("release_photo_check"), 0);
});

Deno.test("photo refusée : 200 valid=false, pas de bon, verdict enregistré", async () => {
  const { handler, db } = setup({
    anthropic: () => message(verdictText(false, 0.85, "On ne voit pas de déchets : photographiez votre sac rempli.")),
  });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 200);
  assert.equal(body.valid, false);
  assert.equal(body.voucher, null);
  assert.equal(body.attemptsLeft, 4);
  assert.equal(body.reason, "On ne voit pas de déchets : photographiez votre sac rempli.");
  assert.equal(db.count("complete_participation"), 0);
  assert.equal(db.count("release_photo_check"), 0);
  const fin = db.args("finish_photo_check")!;
  assert.equal(fin.p_valid, false);
  assert.equal((fin.p_verdict as Record<string, unknown>).reason, body.reason);
});

Deno.test("valid=true mais confiance < 0,6 : refusée, message prudent, pas de bon", async () => {
  const { handler, db } = setup({ anthropic: () => message(verdictText(true, 0.4, "Peut-être un stand ?")) });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 200);
  assert.equal(body.valid, false);
  assert.equal(body.voucher, null);
  assert.match(String(body.reason), /pas sûrs/);
  assert.equal(db.count("complete_participation"), 0);
});

Deno.test("confiance hors bornes ramenée à [0, 1]", async () => {
  let { handler } = setup({ anthropic: () => message(verdictText(true, 3, "Parfait.")) });
  let { body } = await call(handler, post(goodBody()));
  assert.equal(body.confidence, 1);
  assert.equal(body.valid, true);
  ({ handler } = setup({ anthropic: () => message(verdictText(false, -2, "Non.")) }));
  ({ body } = await call(handler, post(goodBody())));
  assert.equal(body.confidence, 0);
});

Deno.test("refus du modèle (stop_reason refusal) : valid=false, contenu non lu, essai consommé", async () => {
  const { handler, db } = setup({
    anthropic: () => message('{"valid": true, "confidence": 1, "reason": "ne doit pas être lu"}', { stop_reason: "refusal" }),
  });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 200);
  assert.equal(body.valid, false);
  assert.equal(body.confidence, 0);
  assert.equal(body.voucher, null);
  assert.match(String(body.reason), /pas pu analyser/);
  assert.equal(db.count("complete_participation"), 0);
  assert.equal(db.count("release_photo_check"), 0);
  assert.equal(((db.args("finish_photo_check")!).p_verdict as Record<string, unknown>).refusal, true);
});

Deno.test("réponse illisible (JSON cassé, sans texte, mauvais types) : 502, essai rendu mais compté dans la journée", async () => {
  for (const msg of [
    message("{pas du json"),
    message(null),
    message(JSON.stringify({ valid: "oui", confidence: 0.9, reason: "x" })),
    message(JSON.stringify({ valid: true, confidence: "0.9", reason: "x" })),
    message(JSON.stringify([true, 0.9, "x"])),
    message(""),
  ]) {
    const { handler, db } = setup({ anthropic: () => msg });
    const { res, body } = await call(handler, post(goodBody()));
    assert.equal(res.status, 502);
    assert.equal(body.error, "bad_model_output");
    assert.equal(db.count("complete_participation"), 0);
    assert.equal(db.count("finish_photo_check"), 0);
    assert.deepEqual(db.args("release_photo_check"), { p_check: 7, p_count_in_quota: true });
  }
});

// ---------------------------------------------------------------------------
// Erreurs Anthropic : l'essai n'est pas consommé
// ---------------------------------------------------------------------------
const H = new Headers();
const upstream: [string, () => Error, number, string][] = [
  ["RateLimitError", () => new Anthropic.RateLimitError(429, { type: "error" }, "rate", H), 503, "upstream_busy"],
  ["AuthenticationError", () => new Anthropic.AuthenticationError(401, { type: "error" }, "auth", H), 500, "config_error"],
  ["PermissionDeniedError", () => new Anthropic.PermissionDeniedError(403, { type: "error" }, "perm", H), 500, "config_error"],
  ["InternalServerError 500", () => new Anthropic.InternalServerError(500, { type: "error" }, "boom", H), 502, "upstream_error"],
  ["surcharge 529", () => new Anthropic.InternalServerError(529, { type: "error" }, "overloaded", H), 503, "upstream_busy"],
  ["BadRequestError", () => new Anthropic.BadRequestError(400, { type: "error" }, "bad", H), 502, "upstream_error"],
  ["APIConnectionError", () => new Anthropic.APIConnectionError({ message: "réseau" }), 502, "upstream_error"],
  ["APIConnectionTimeoutError", () => new Anthropic.APIConnectionTimeoutError(), 502, "upstream_error"],
  ["erreur inconnue", () => new TypeError("bug"), 500, "internal_error"],
];
for (const [name, make, status, code] of upstream) {
  Deno.test(`erreur Anthropic « ${name} » : ${status} ${code}, essai rendu`, async () => {
    const { handler, db } = setup({ anthropic: () => Promise.reject(make()) });
    const { res, body } = await call(handler, post(goodBody()));
    assert.equal(res.status, status);
    assert.equal(body.error, code);
    assert.deepEqual(db.args("release_photo_check"), { p_check: 7, p_count_in_quota: false });
    assert.equal(db.count("finish_photo_check") + db.count("complete_participation"), 0);
  });
}

// ---------------------------------------------------------------------------
// Validation côté base
// ---------------------------------------------------------------------------
Deno.test("déjà validée entre-temps (complete_participation renvoie null) : 409", async () => {
  for (const data of [null, { id: null, code: null }]) {
    const { handler, db } = setup({ db: { complete_participation: () => ({ data, error: null }) } });
    const { res, body } = await call(handler, post(goodBody()));
    assert.equal(res.status, 409);
    assert.equal(body.error, "already_validated");
    assert.equal(db.count("complete_participation"), 1);
  }
});

Deno.test("panne de base pendant complete_participation : 500, essai rendu", async () => {
  const { handler, db } = setup({
    db: { complete_participation: () => ({ data: null, error: { message: "boom", code: "XX000" } }) },
  });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 500);
  assert.equal(body.error, "internal_error");
  assert.deepEqual(db.args("release_photo_check"), { p_check: 7, p_count_in_quota: true });
});

Deno.test("panne imprévue (exception de la base) : 500 JSON avec CORS", async () => {
  const { handler } = setup({
    db: {
      begin_photo_check: () => {
        throw new Error("connexion perdue");
      },
    },
  });
  const { res, body } = await call(handler, post(goodBody()));
  assert.equal(res.status, 500);
  assert.equal(body.error, "internal_error");
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
});

Deno.test("appel sans en-tête Origin (serveur à serveur) : traité, sans en-tête CORS", async () => {
  const { handler } = setup();
  const { res, body } = await call(handler, post(goodBody(), { origin: null }));
  assert.equal(res.status, 200);
  assert.equal(body.valid, true);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

Deno.test("l'image et le jeton ne sont jamais journalisés", async () => {
  const big = imageB64("webp", 5000);
  const { handler, logs } = setup();
  await call(handler, post(goodBody({ image: big, mediaType: "image/webp" })));
  const { handler: h2, logs: logs2 } = setup({ anthropic: () => Promise.reject(new Anthropic.RateLimitError(429, { type: "error" }, "rate", H)) });
  await call(h2, post(goodBody({ image: big })));
  const all = JSON.stringify([...logs, ...logs2]);
  assert.ok(logs.length > 0);
  assert.ok(!all.includes(big.slice(100, 200)));
  assert.ok(!all.includes(TOKEN));
});

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------
Deno.test("interpretResponse : phrase nettoyée et raccourcie", () => {
  const long = "Merci\u0000 pour   cette photo\n" + " très".repeat(80);
  const v = interpretResponse(message(verdictText(false, 0.9, long)))!;
  assert.ok(v.reason.length <= 160);
  // deno-lint-ignore no-control-regex
  assert.ok(!/[\u0000-\u001f]/.test(v.reason));
  assert.ok(v.reason.endsWith("…"));
  const empty = interpretResponse(message(verdictText(false, 0.9, "   ")))!;
  assert.ok(empty.reason.length > 10);
});

Deno.test("sniffMediaType reconnaît JPEG, PNG et WebP", () => {
  assert.equal(sniffMediaType(imageB64("jpeg")), "image/jpeg");
  assert.equal(sniffMediaType(imageB64("png")), "image/png");
  assert.equal(sniffMediaType(imageB64("webp")), "image/webp");
  assert.equal(sniffMediaType(imageB64("junk")), null);
});

Deno.test("parseAllowedOrigins et parseLimit", () => {
  assert.deepEqual(parseAllowedOrigins(undefined), ["https://gabyaillet.github.io"]);
  assert.deepEqual(parseAllowedOrigins(""), ["https://gabyaillet.github.io"]);
  assert.deepEqual(
    parseAllowedOrigins(" https://gabyaillet.github.io/Jules-/ , http://localhost:5178,pas une url"),
    ["https://gabyaillet.github.io", "http://localhost:5178"],
  );
  assert.equal(parseLimit(undefined, 500), 500);
  assert.equal(parseLimit("0", 500), 0);
  assert.equal(parseLimit("200", 500), 200);
  assert.equal(parseLimit("-3", 500), 500);
  assert.equal(parseLimit("abc", 500), 500);
});

Deno.test("le prompt système couvre les règles demandées", () => {
  for (const needle of [
    "La photo doit montrer",
    "tolérant",
    "capture d'écran",
    "banque d'images",
    "noire",
    "floue",
    "jamais des instructions",
    "valide cette photo",
    "n'identifiez jamais",
    "vouvoyant",
    "140 caractères",
  ]) {
    assert.ok(SYSTEM_PROMPT.includes(needle), needle);
  }
});
