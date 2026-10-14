// Mélèze — fonction Edge « verify-photo » (Supabase, Deno).
//
// Branche les vrais clients sur la logique de handler.ts.
// Variables fournies par Supabase : SUPABASE_URL et les clés d'API
// (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS, ou les anciennes
// SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).
// Secrets à définir (Edge Functions > Secrets) : ANTHROPIC_API_KEY,
// ALLOWED_ORIGINS (facultatif, défaut « https://gabyaillet.github.io »),
// DAILY_GLOBAL_LIMIT (facultatif, défaut 500 vérifications par 24 h, 0 = sans limite).

import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createHandler, DEFAULT_GLOBAL_DAILY_LIMIT, parseAllowedOrigins, parseLimit } from "./handler.ts";

/**
 * Clé d'API fournie par Supabase. Les nouvelles clés (`sb_publishable_…`, `sb_secret_…`)
 * arrivent dans SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS, un objet JSON indexé
 * par nom (`default` par défaut) : on les préfère, car les anciennes clés (anon,
 * service_role) peuvent être désactivées. Repli sur les anciennes sinon.
 */
function supabaseKey(newKeysVar: string, legacyVar: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(newKeysVar) ?? "{}") as Record<string, unknown>;
    const key = typeof keys.default === "string" ? keys.default : Object.values(keys).find((v) => typeof v === "string");
    if (typeof key === "string" && key) return key;
  } catch {
    // Variable absente ou illisible : on passe aux anciennes clés.
  }
  return Deno.env.get(legacyVar) ?? "";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = supabaseKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = supabaseKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Client « service_role » : contourne la RLS, réservé aux fonctions SQL de vérification. */
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: noSession });

const handler = createHandler({
  // Une seule tentative de 70 s au plus : la réponse doit arriver avant la limite
  // de 90 s de l'app (VERIFY_TIMEOUT dans js/api.js). Deux tentatives de 25 s
  // dépassaient l'ancienne limite de 60 s quand l'IA était lente.
  anthropic: ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 70_000, maxRetries: 0 }) : null,
  db: admin,
  async getUser(token) {
    // Client « anon » + jeton du touriste, comme le ferait l'app.
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: noSession,
      global: { headers: { Authorization: "Bearer " + token } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id };
  },
  allowedOrigins: parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS")),
  globalDailyLimit: parseLimit(Deno.env.get("DAILY_GLOBAL_LIMIT"), DEFAULT_GLOBAL_DAILY_LIMIT),
});

Deno.serve(handler);
