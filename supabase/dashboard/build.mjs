// Mélèze — fabrique supabase/dashboard/verify-photo.ts : la fonction verify-photo en
// UN SEUL fichier, à coller dans l'éditeur du tableau de bord Supabase (Edge Functions →
// verify-photo → index.ts). Évite les erreurs de copie entre index.ts et handler.ts.
// À relancer après chaque modification de supabase/functions/verify-photo/ :
//   node supabase/dashboard/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'functions', 'verify-photo');
const handler = readFileSync(join(src, 'handler.ts'), 'utf8');
const index = readFileSync(join(src, 'index.ts'), 'utf8');

const importLine = /^import\s[^;]+;\s*$/gm;
const handlerImports = handler.match(importLine) || [];
const indexImports = (index.match(importLine) || []).filter((l) => !l.includes('./handler.ts'));
const imports = [...new Set([...handlerImports, ...indexImports].map((l) => l.trim()))];

const out = [
  '// ============================================================================',
  '// Mélèze — fonction « verify-photo » en UN SEUL FICHIER (tableau de bord Supabase).',
  '// Fichier GÉNÉRÉ par supabase/dashboard/build.mjs à partir de',
  '// supabase/functions/verify-photo/handler.ts + index.ts : ne pas le modifier à la main.',
  '// Collez TOUT ce fichier dans index.ts de la fonction verify-photo (aucun autre fichier).',
  '// ============================================================================',
  '',
  ...imports,
  '',
  '// ---------------------------------------------------------------- handler.ts',
  handler.replace(importLine, '').trim(),
  '',
  '// ---------------------------------------------------------------- index.ts',
  index.replace(importLine, '').trim(),
  '',
].join('\n');
writeFileSync(join(here, 'verify-photo.ts'), out);
console.log('supabase/dashboard/verify-photo.ts écrit (' + out.length + ' caractères)');
