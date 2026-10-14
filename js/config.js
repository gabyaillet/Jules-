/* ==========================================================================
   Mélèze — configuration du serveur (Supabase)
   POUR BRANCHER L'APPLICATION : coller ici les deux valeurs PUBLIQUES du
   projet Supabase, dans le tableau de bord Supabase :
     Project Settings → API (ou « Connect » en haut du tableau de bord)
       · supabaseUrl     : « Project URL »        ex. https://abcdefgh.supabase.co
       · supabaseAnonKey : clé « anon » (legacy) ou « publishable » (sb_publishable_…)
   Ces deux valeurs sont faites pour être publiques : la sécurité repose sur
   les règles d'accès (RLS) de la base, voir supabase/migrations/0001_init.sql.
   ⚠ JAMAIS la clé « service_role » / « secret » ni la clé Anthropic ici :
     elles restent dans les secrets de la fonction verify-photo.
   Tant que ces champs sont vides, l'application affiche « Bientôt disponible »
   et n'appelle aucun serveur.
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
