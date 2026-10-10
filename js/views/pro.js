/* ==========================================================================
   Vue : Espace Pro / Partenaire
   - Connexion simulée (rôle + structure)
   - Onglet "Scanner"  : interface adaptative selon le code scanné
   - Onglet "Créer"    : mission + contrepartie obligatoire, publiée aussitôt
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.pro = (function () {
  'use strict';
  const { esc, icon, qr, duration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  const ROLES = ['Commerçant partenaire', 'Référent de mission', 'Office de tourisme'];
  const CATEGORIES = ['Expérience', 'Produit local', 'Gourmandise', 'Équipement'];
  const DURATIONS = [30, 45, 60, 90, 120, 150, 180];

  // Conteneur commun : même rythme vertical que les autres pages
  const WRAP = 'mx-auto px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16';
  const LEGEND = 'float-left mb-1 w-full font-display text-2xl font-bold tracking-[-0.02em]';

  // État local de l'écran
  let scanned = null; // dernier code scanné
  let flash = null; // message de succès après une validation (HTML déjà échappé)
  let created = null; // dernière mission créée (écran de confirmation)

  function field(id, label, control, hint) {
    return '<div><label class="label" for="' + id + '">' + label + '</label>' + control + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }

  /** Bloc "En échange" dans la couleur du type de mission. */
  function rewardBlock(m) {
    return '<div class="mt-4 rounded-2xl px-4 py-3 text-night ' + typeOf(m.type).color + '">' +
      '<p class="text-sm text-night/60">En échange</p>' +
      '<p class="font-display font-bold leading-snug">' + esc(m.reward.title) + '</p>' +
      (m.reward.partner ? '<p class="text-sm text-night/70">' + esc(m.reward.partner) + '</p>' : '') +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Connexion
  // ------------------------------------------------------------------------
  function renderLogin() {
    const demo = Meleze.data.proDemo;
    return '<div class="' + WRAP + ' max-w-md">' +
      '<span class="tag">Espace partenaires</span>' +
      '<h1 id="page-title" tabindex="-1" class="mt-4 text-5xl font-extrabold sm:text-6xl">Connexion <span class="mark">pro</span></h1>' +
      '<p class="mt-4 text-lg text-muted">Commerçants, référents de mission, Office de tourisme : validez les missions, encaissez les bons et publiez de nouvelles missions.</p>' +
      '<form class="card mt-8 space-y-5 p-5 sm:p-7" data-form="login" novalidate>' +
        field('email', 'E-mail professionnel', '<input class="field" id="email" name="email" type="email" autocomplete="username" required value="' + esc(demo.email) + '">') +
        field('pin', 'Code PIN', '<input class="field tracking-[0.4em]" id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required placeholder="••••">') +
        field('role', 'Je suis', '<select class="field" id="role" name="role">' + ROLES.map((r) => '<option>' + esc(r) + '</option>').join('') + '</select>') +
        field('org', 'Structure', '<input class="field" id="org" name="org" required value="Téléphérique du Mont Bochor">') +
        '<p class="rounded-2xl bg-lime-200 px-4 py-3 text-[0.95rem] text-night">Pour la démo : ' + esc(demo.email) + ', PIN <strong>' + esc(demo.pin) + '</strong></p>' +
        '<button class="btn-primary w-full">Se connecter</button>' +
      '</form>' +
      '<a href="#/" class="link mt-8">Retour au site</a>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Coquille connectée + onglets
  // ------------------------------------------------------------------------
  function renderShell(pro, tab, inner) {
    const tabLink = (id, label) =>
      '<a href="#/pro/' + id + '" class="flex min-h-[48px] flex-1 items-center justify-center rounded-full px-3 text-center font-display font-semibold transition-colors ' +
      (tab === id ? 'bg-ink text-surface' : 'text-muted hover:text-ink') + '"' + (tab === id ? ' aria-current="page"' : '') + '>' + label + '</a>';

    return '<div class="' + WRAP + ' max-w-2xl">' +
      '<div class="flex items-center justify-between gap-4">' +
        '<p class="min-w-0 text-sm text-muted">' + esc(pro.role) + '</p>' +
        '<button type="button" class="btn-secondary btn-sm shrink-0" data-action="logout">Se déconnecter</button>' +
      '</div>' +
      '<h1 id="page-title" tabindex="-1" class="mt-3 break-words text-4xl font-extrabold sm:text-5xl">' + esc(pro.org) + '</h1>' +
      '<nav class="mt-8 flex gap-1 rounded-full bg-sunk p-1" aria-label="Outils pro">' +
        tabLink('scan', 'Scanner') + tabLink('creer', 'Créer une mission') +
      '</nav>' +
      '<div class="mt-10">' + inner + '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Onglet Scanner
  // ------------------------------------------------------------------------
  function renderScanner(state) {
    const user = state.user;
    // Codes de démonstration : on "présente" un QR devant le viseur
    const demos = [{ code: user.code, label: 'QR de ' + user.firstName }]
      .concat(state.vouchers.map((v) => ({ code: v.code, label: 'Bon ' + v.code.slice(-4) + (v.status === 'consomme' ? ' (déjà utilisé)' : '') })));

    return '<section aria-labelledby="scan-h">' +
      '<h2 id="scan-h" class="sr-only">Scanner un QR code</h2>' +
      '<div class="grid gap-6 sm:grid-cols-[15rem_1fr] sm:items-center sm:gap-8">' +
        '<div class="scan-frame">' +
          '<span class="scan-corner left-5 top-5 rounded-tl-xl border-l-[3px] border-t-[3px]"></span>' +
          '<span class="scan-corner right-5 top-5 rounded-tr-xl border-r-[3px] border-t-[3px]"></span>' +
          '<span class="scan-corner bottom-5 left-5 rounded-bl-xl border-b-[3px] border-l-[3px]"></span>' +
          '<span class="scan-corner bottom-5 right-5 rounded-br-xl border-b-[3px] border-r-[3px]"></span>' +
          (scanned
            ? '<div class="absolute inset-0 flex items-center justify-center p-14">' + qr(scanned, { size: 'w-full' }) + '</div>'
            : '<span class="scan-line"></span><p class="absolute inset-x-0 bottom-9 text-center text-sm text-white/80">Placez le QR dans le cadre</p>') +
        '</div>' +

        '<div class="min-w-0">' +
          '<form class="flex gap-2" data-form="scan">' +
            '<label for="code" class="sr-only">Code du QR</label>' +
            '<input class="field min-w-0 font-mono uppercase tracking-wide" id="code" name="code" placeholder="Ou tapez le code : MLZ-…" autocomplete="off" autocapitalize="characters" value="' + esc(scanned || '') + '">' +
            '<button class="btn-primary shrink-0">Lire</button>' +
          '</form>' +
          '<p class="mt-6 text-sm text-muted">Pour la démo, présentez un de ces QR :</p>' +
          '<div class="mt-3 flex flex-wrap gap-2">' +
            demos.map((d) => '<button type="button" class="chip" data-action="scan-demo" data-code="' + esc(d.code) + '" aria-pressed="' + (scanned === d.code) + '">' + esc(d.label) + '</button>').join('') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="mt-10" aria-live="polite">' + (flash ? flashBox() : '') + (scanned ? renderResult(store.lookup(scanned)) : '') + '</div>' +
    '</section>';
  }

  function flashBox() {
    return '<div class="mb-6 rounded-3xl bg-lime-300 px-5 py-4 text-night">' +
      '<p class="font-display font-bold">Mission validée</p>' +
      '<p class="mt-1 text-night/75">' + flash + '</p>' +
    '</div>';
  }

  /** Le cœur "intelligent" : l'écran s'adapte à la nature du code lu. */
  function renderResult(r) {
    if (r.kind === 'unknown') {
      return '<div class="rounded-2xl border-l-4 border-danger bg-sunk px-5 py-4">' +
        '<p class="font-display font-bold">Code inconnu</p>' +
        '<p class="mt-1 text-muted">« ' + esc(r.code) + ' » ne correspond à aucun participant ni à aucun bon.</p>' +
      '</div>';
    }

    // --- QR d'un touriste : missions à valider --------------------------------
    if (r.kind === 'user') {
      const rows = r.items.map(({ participation: p, mission: m }) => {
        const ready = p.status === 'terminee';
        const type = typeOf(m.type);
        return '<li class="card p-5 sm:p-6">' +
          '<div class="flex flex-wrap items-center gap-x-3 gap-y-2">' +
            '<span class="tag ' + type.color + '">' + esc(type.label) + '</span>' +
            '<span class="text-sm text-muted">' + duration(m.duration) + ' · ' + esc(m.location) + '</span>' +
          '</div>' +
          '<h3 class="mt-3 text-xl sm:text-2xl">' + esc(m.title) + '</h3>' +
          rewardBlock(m) +
          (ready
            ? '<button type="button" class="btn-primary mt-5 w-full" data-action="validate" data-id="' + esc(p.id) + '">Valider la mission</button>'
            : '<p class="mt-4 text-[0.95rem] text-muted">Le participant n’a pas encore indiqué avoir terminé cette mission.</p>') +
        '</li>';
      }).join('');
      return '<div class="flex items-center gap-4">' +
          '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime-300 font-display text-xl font-bold text-night">' + esc(r.user.firstName[0]) + '</span>' +
          '<div class="min-w-0"><p class="font-display text-xl font-bold">' + esc(r.user.firstName) + '</p><p class="font-mono text-sm text-muted">' + esc(r.user.code) + '</p></div>' +
        '</div>' +
        (rows ? '<ul class="mt-6 space-y-4">' + rows + '</ul>' : '<p class="mt-6 rounded-2xl bg-sunk px-5 py-4 text-muted">Aucune mission en cours pour ce participant.</p>');
    }

    // --- Bon de récompense : consommation unique ---------------------------------
    const v = r.voucher;
    const used = v.status === 'consomme';
    return '<div class="p-5 sm:p-6 ' + (used ? 'rounded-3xl bg-sunk' : 'card') + '">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<span class="tag ' + (used ? 'bg-coral' : 'bg-lime-300') + '">' + (used ? 'Déjà utilisé' : 'Bon valable') + '</span>' +
        '<span class="font-mono text-sm font-semibold">' + esc(v.code) + '</span>' +
      '</div>' +
      '<h3 class="mt-4 text-2xl ' + (used ? 'text-muted line-through decoration-1' : '') + '">' + esc(v.title) + '</h3>' +
      '<p class="mt-1 text-muted">' + esc(v.partner) + ' · reçu le ' + date(v.issuedAt) + '</p>' +
      (used
        ? '<button type="button" class="btn mt-6 w-full bg-card text-muted" disabled>Bon utilisé le ' + date(v.usedAt) + '</button>'
        : '<button type="button" class="btn-primary mt-6 w-full" data-action="consume" data-id="' + esc(v.id) + '">Consommer le bon</button>') +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Onglet Création de mission
  // ------------------------------------------------------------------------
  function renderCreate(pro) {
    if (created) {
      // Bloc lime : boutons en noir explicite (lisibles aussi en mode sombre)
      return '<div class="rounded-4xl bg-lime-300 p-6 text-night sm:p-8">' +
        '<p class="font-display font-bold">Mission publiée</p>' +
        '<h2 class="mt-2 text-3xl text-night sm:text-4xl">« ' + esc(created.title) + ' »</h2>' +
        '<p class="mt-3 max-w-xl text-night/75">Elle est visible dès maintenant dans le catalogue, avec sa contrepartie : ' + esc(created.reward.title) + '.</p>' +
        '<div class="mt-8 flex flex-wrap items-center gap-3">' +
          '<a href="#/missions?focus=' + esc(created.id) + '" class="btn bg-night text-white hover:opacity-85">Voir dans le catalogue' + icon('arrow', 'h-5 w-5') + '</a>' +
          '<button type="button" class="btn border-2 border-night bg-transparent text-night hover:bg-night hover:text-white" data-action="new-mission">Créer une autre mission</button>' +
        '</div>' +
      '</div>';
    }

    const { SEASONS, TYPES } = Meleze.data;
    return '<form class="space-y-6" data-form="create">' +
      '<fieldset class="card space-y-5 p-5 sm:p-7">' +
        '<legend class="' + LEGEND + '">La mission</legend>' +
        field('title', 'Intitulé', '<input class="field" id="title" name="title" required maxlength="80" placeholder="Ex. Nettoyer les berges du Doron">') +
        field('type', 'Type', '<select class="field" id="type" name="type" required>' + TYPES.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>').join('') + '</select>') +
        '<div><p class="label" id="seasons-l">Saison(s)</p><div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="seasons-l">' +
          SEASONS.map((s) => '<label class="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-transparent bg-sunk px-4 font-semibold transition-colors has-[:checked]:border-night has-[:checked]:bg-lime-200 has-[:checked]:text-night">' +
            '<input type="checkbox" name="seasons" value="' + esc(s.id) + '" class="h-5 w-5 shrink-0 accent-[#121614]">' + esc(s.label) + '</label>').join('') +
        '</div></div>' +
        '<div class="grid grid-cols-2 gap-4">' +
          field('duration', 'Durée', '<select class="field" id="duration" name="duration">' + DURATIONS.map((d) => '<option value="' + d + '"' + (d === 90 ? ' selected' : '') + '>' + duration(d) + '</option>').join('') + '</select>') +
          field('spots', 'Places', '<input class="field" id="spots" name="spots" type="number" min="1" max="500" value="10" required inputmode="numeric">') +
        '</div>' +
        field('location', 'Lieu de rendez-vous', '<input class="field" id="location" name="location" required placeholder="Ex. Pont de la Pêche">') +
        field('schedule', 'Quand ?', '<input class="field" id="schedule" name="schedule" placeholder="Ex. Samedi, 9h30">') +
        field('description', 'Description', '<textarea class="field min-h-[7rem]" id="description" name="description" required maxlength="400" placeholder="Ce que les participants vont faire, ce qu’il faut prévoir…"></textarea>') +
      '</fieldset>' +

      // Contrepartie : bloc mis en avant, champs obligatoires
      '<fieldset class="space-y-5 rounded-3xl bg-tint p-5 ring-2 ring-lime-400 sm:p-7">' +
        '<legend class="' + LEGEND + ' flex flex-wrap items-center gap-3">La contrepartie <span class="tag bg-lime-400">Obligatoire</span></legend>' +
        '<p class="text-muted">Chaque mission offre quelque chose en échange : c’est le principe de Mélèze.</p>' +
        field('rtitle', 'Ce que vous offrez', '<input class="field" id="rtitle" name="rtitle" required maxlength="80" placeholder="Ex. Une descente en luge">') +
        field('rpartner', 'Offert par', '<input class="field" id="rpartner" name="rpartner" required value="' + esc(pro.org) + '">') +
        field('rcat', 'Catégorie', '<select class="field" id="rcat" name="rcat">' + CATEGORIES.map((c) => '<option>' + esc(c) + '</option>').join('') + '</select>') +
        '<label class="flex cursor-pointer items-start gap-3"><input type="checkbox" name="commit" required class="mt-1 h-5 w-5 shrink-0 accent-[#121614]">Je m’engage à offrir cette contrepartie à chaque participant dont la mission est validée.</label>' +
      '</fieldset>' +

      '<button class="btn-primary w-full">Publier la mission</button>' +
    '</form>';
  }

  // ------------------------------------------------------------------------
  function render(state, params, sub) {
    const pro = store.pro;
    if (!pro) return renderLogin();
    const tab = sub === 'creer' ? 'creer' : 'scan';
    return renderShell(pro, tab, tab === 'scan' ? renderScanner(state) : renderCreate(pro));
  }

  const actions = {
    logout(el, app) { store.logout(); scanned = flash = created = null; app.go('#/'); },
    'scan-demo'(el, app) { scanned = el.dataset.code; flash = null; app.rerender(); },
    validate(el, app) {
      const v = store.validate(el.dataset.id);
      if (v) {
        flash = 'Le bon <span class="font-mono">' + esc(v.code) + '</span> (' + esc(v.title) + ') est arrivé dans l’espace du participant.';
        toast('Mission validée');
      }
      app.rerender();
    },
    consume(el, app) {
      const v = store.consume(el.dataset.id);
      if (v) { flash = null; toast('Bon consommé. Bonne journée !'); }
      app.rerender();
    },
    'new-mission'(el, app) { created = null; app.rerender(); },
  };

  const forms = {
    login(form, app) {
      const f = new FormData(form);
      const demo = Meleze.data.proDemo;
      if (String(f.get('pin')) !== demo.pin) {
        toast('Code PIN incorrect (pour la démo : ' + demo.pin + ')', 'error');
        form.pin.focus();
        return;
      }
      if (!String(f.get('org')).trim()) { form.org.focus(); return; }
      store.login({ email: String(f.get('email')), role: String(f.get('role')), org: String(f.get('org')).trim() });
      toast('Vous êtes connecté·e');
      app.go('#/pro/scan');
    },
    scan(form, app) {
      const code = String(new FormData(form).get('code')).trim().toUpperCase();
      scanned = code || null;
      flash = null;
      app.rerender();
    },
    create(form, app) {
      const f = new FormData(form);
      const seasons = f.getAll('seasons');
      if (!seasons.length) {
        toast('Choisissez au moins une saison.', 'error');
        form.querySelector('[name="seasons"]').focus();
        return;
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const t = (k) => String(f.get(k) || '').trim();
      created = store.addMission({
        title: t('title'),
        type: t('type'),
        seasons,
        duration: Number(f.get('duration')),
        spots: Number(f.get('spots')),
        location: t('location'),
        schedule: t('schedule'),
        description: t('description'),
        host: store.pro.org,
        reward: { title: t('rtitle'), partner: t('rpartner'), category: t('rcat') },
      });
      toast('Mission publiée dans le catalogue');
      app.rerender();
    },
  };

  return { title: 'Espace pro', render, actions, forms };
})();
