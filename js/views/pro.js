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
  const { esc, icon, qr, photo, duration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  const ROLES = ['Commerçant partenaire', 'Référent de mission', 'Office de tourisme'];
  const CATEGORIES = ['Expérience', 'Produit local', 'Gourmandise', 'Équipement'];
  const DURATIONS = [30, 45, 60, 90, 120, 150, 180];

  // État local de l'écran scanner
  let scanned = null; // dernier code scanné
  let flash = null; // message de succès après une action
  let created = null; // dernière mission créée (écran de confirmation)

  // ------------------------------------------------------------------------
  // Connexion
  // ------------------------------------------------------------------------
  function renderLogin() {
    const demo = Meleze.data.proDemo;
    return '<div class="mx-auto grid max-w-app gap-8 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-2 lg:items-stretch lg:pt-12">' +
      '<div class="ph scrim relative min-h-[16rem] rounded-[2rem] text-snow-50 lg:min-h-full">' + photo('peak', { sizes: '(min-width:1024px) 50vw, 100vw', alt: '' }) +
        '<div class="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-8">' +
          '<span class="badge-glass">' + icon('lock', 'h-3.5 w-3.5') + 'Espace partenaires</span>' +
          '<h1 id="page-title" tabindex="-1" class="mt-4 text-5xl leading-[0.95] sm:text-6xl">Connexion <em class="text-larch-300">pro</em></h1>' +
          '<p class="mt-3 max-w-sm text-snow-100/85">Commerçants, référents et Office de tourisme&nbsp;: validez les missions, encaissez les bons et publiez vos propres missions.</p>' +
        '</div>' +
      '</div>' +
      '<div class="lg:py-6"><form class="card space-y-5 p-6 sm:p-8" data-form="login" novalidate>' +
        field('email', 'E-mail professionnel', '<input class="field" id="email" name="email" type="email" autocomplete="username" required value="' + demo.email + '">') +
        field('pin', 'Code PIN', '<input class="field tracking-[0.5em]" id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required placeholder="••••">') +
        field('role', 'Je suis', '<select class="field" id="role" name="role">' + ROLES.map((r) => '<option>' + r + '</option>').join('') + '</select>') +
        field('org', 'Structure', '<input class="field" id="org" name="org" required value="Téléphérique du Mont Bochor">') +
        '<p class="rounded-2xl bg-accent/15 p-4 text-sm"><strong>Démo&nbsp;:</strong> ' + demo.email + ' · PIN <strong>' + demo.pin + '</strong></p>' +
        '<button class="btn-primary w-full">Se connecter <span class="btn-arrow">' + icon('arrow', 'h-4 w-4') + '</span></button>' +
      '</form>' +
      '<a href="#/" class="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">Retour à l’espace touriste</a></div>' +
    '</div>';
  }

  function field(id, label, control, hint) {
    return '<div><label class="label" for="' + id + '">' + label + '</label>' + control + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }

  // ------------------------------------------------------------------------
  // Coquille connectée + onglets
  // ------------------------------------------------------------------------
  function renderShell(pro, tab, inner) {
    const tabLink = (id, label, ic) =>
      '<a href="#/pro/' + id + '" class="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ' +
      (tab === id ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink') + '"' + (tab === id ? ' aria-current="page"' : '') + '>' + icon(ic) + label + '</a>';

    return '<div class="mx-auto max-w-2xl px-5 pb-16 pt-10 sm:px-8">' +
      '<div class="flex items-start justify-between gap-4">' +
        '<div><p class="eyebrow">' + esc(pro.role) + '</p>' +
        '<h1 id="page-title" tabindex="-1" class="mt-3 text-5xl leading-[0.95] sm:text-6xl">' + esc(pro.org) + '</h1></div>' +
        '<button type="button" class="btn-ghost btn-sm shrink-0" data-action="logout" aria-label="Se déconnecter">' + icon('logout', 'h-4 w-4') + '<span class="hidden sm:inline">Quitter</span></button>' +
      '</div>' +
      '<nav class="mt-8 flex gap-1 rounded-full bg-sunk p-1 ring-1 ring-line" aria-label="Outils pro">' +
        tabLink('scan', 'Scanner', 'scan') + tabLink('creer', 'Créer une mission', 'plus') +
      '</nav>' +
      '<div class="mt-8">' + inner + '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Onglet Scanner
  // ------------------------------------------------------------------------
  function renderScanner(state) {
    const user = state.user;
    // Codes de démonstration : on "présente" un QR devant le viseur
    const demos = [{ code: user.code, label: 'QR de ' + user.firstName }]
      .concat(state.vouchers.map((v) => ({ code: v.code, label: 'Bon ' + v.code.slice(-4) + (v.status === 'consomme' ? ' (utilisé)' : '') })));

    return '<section aria-labelledby="scan-h">' +
      '<h2 id="scan-h" class="sr-only">Scanner un QR code</h2>' +
      '<div class="scan-frame">' +
        '<span class="scan-corner left-5 top-5 rounded-tl-2xl border-l-4 border-t-4"></span>' +
        '<span class="scan-corner right-5 top-5 rounded-tr-2xl border-r-4 border-t-4"></span>' +
        '<span class="scan-corner bottom-5 left-5 rounded-bl-2xl border-b-4 border-l-4"></span>' +
        '<span class="scan-corner bottom-5 right-5 rounded-br-2xl border-b-4 border-r-4"></span>' +
        (scanned
          ? '<div class="absolute inset-0 flex items-center justify-center p-14 opacity-90">' + qr(scanned, { size: 'w-full' }) + '</div>'
          : '<span class="scan-line"></span><p class="absolute inset-x-0 bottom-10 text-center text-sm font-semibold text-snow-200">Placez le QR dans le cadre</p>') +
      '</div>' +

      '<form class="mt-6 flex gap-2" data-form="scan">' +
        '<label for="code" class="sr-only">Code du QR</label>' +
        '<input class="field font-mono uppercase tracking-wider" id="code" name="code" placeholder="MLZ-…" autocomplete="off" autocapitalize="characters" value="' + esc(scanned || '') + '">' +
        '<button class="btn-primary shrink-0">' + icon('scan') + '<span class="sr-only sm:not-sr-only">Lire</span></button>' +
      '</form>' +
      '<p class="mt-4 text-sm font-semibold text-muted">Simulation — présenter un QR&nbsp;:</p>' +
      '<div class="mt-2 flex flex-wrap gap-2">' +
        demos.map((d) => '<button type="button" class="chip" data-action="scan-demo" data-code="' + esc(d.code) + '" aria-pressed="' + (scanned === d.code) + '">' + esc(d.label) + '</button>').join('') +
      '</div>' +

      '<div class="mt-8" aria-live="polite">' + (flash ? flashBox() : '') + (scanned ? renderResult(store.lookup(scanned)) : '') + '</div>' +
    '</section>';
  }

  function flashBox() {
    return '<div class="mb-4 flex items-start gap-3 rounded-[1.5rem] bg-ok/15 p-4 font-medium text-ok">' + icon('check', 'h-6 w-6 shrink-0') + '<span>' + flash + '</span></div>';
  }

  /** Le cœur "intelligent" : l'écran s'adapte à la nature du code lu. */
  function renderResult(r) {
    if (r.kind === 'unknown') {
      return '<div class="card flex items-start gap-3 border-danger/40 p-5">' + icon('alert', 'h-6 w-6 shrink-0 text-danger') +
        '<div><p class="font-semibold">Code inconnu</p><p class="text-sm text-muted">« ' + esc(r.code) + ' » ne correspond à aucun participant ni bon Mélèze.</p></div></div>';
    }

    // --- QR d'un touriste : missions à valider --------------------------------
    if (r.kind === 'user') {
      const rows = r.items.map(({ participation: p, mission: m }) => {
        const ready = p.status === 'terminee';
        return '<li class="card p-5">' +
          '<p class="flex items-center gap-2 text-sm text-muted">' + icon(typeOf(m.type).icon, 'h-4 w-4') + duration(m.duration) + ' · ' + esc(m.location) + '</p>' +
          '<h3 class="mt-1 text-2xl leading-[1.05]">' + esc(m.title) + '</h3>' +
          '<p class="mt-2 flex items-center gap-2 text-sm">' + icon('gift', 'h-4 w-4 text-accent-ink') + '<span>Récompense&nbsp;: <strong>' + esc(m.reward.title) + '</strong></span></p>' +
          (ready
            ? '<button type="button" class="btn-accent mt-4 w-full" data-action="validate" data-id="' + esc(p.id) + '">' + icon('check') + 'Valider la mission</button>'
            : '<p class="mt-4 rounded-2xl bg-sunk p-3 text-sm text-muted">Mission pas encore déclarée terminée par le participant.</p>') +
        '</li>';
      }).join('');
      return '<div class="flex items-center gap-3">' +
          '<span class="flex h-14 w-14 items-center justify-center rounded-full bg-accent font-serif text-2xl text-on-accent">' + esc(r.user.firstName[0]) + '</span>' +
          '<div><p class="text-sm text-muted">Participant·e</p><p class="text-xl font-semibold">' + esc(r.user.firstName) + ' <span class="font-mono text-sm text-muted">' + esc(r.user.code) + '</span></p></div>' +
        '</div>' +
        (rows ? '<ul class="mt-4 space-y-3">' + rows + '</ul>' : '<p class="card mt-4 p-5 text-muted">Aucune mission en cours pour ce participant.</p>');
    }

    // --- Bon de récompense : consommation unique ---------------------------------
    const v = r.voucher;
    const used = v.status === 'consomme';
    return '<div class="card p-5 ' + (used ? 'bg-sunk' : '') + '">' +
      '<div class="flex items-center justify-between gap-3">' +
        '<span class="badge ' + (used ? 'bg-danger/15 text-danger' : 'bg-ok/15 text-ok') + '">' + (used ? 'Déjà utilisé' : 'Bon valable') + '</span>' +
        '<span class="font-mono text-sm font-bold">' + esc(v.code) + '</span>' +
      '</div>' +
      '<h3 class="mt-4 text-3xl leading-[1.05] ' + (used ? 'text-muted line-through decoration-1' : '') + '">' + esc(v.title) + '</h3>' +
      '<p class="text-sm text-muted">' + esc(v.partner) + ' · émis le ' + date(v.issuedAt) + '</p>' +
      (used
        ? '<button type="button" class="btn mt-5 w-full bg-mineral-300 text-mineral-700" disabled>' + icon('x') + 'Bon consommé le ' + date(v.usedAt) + '</button>'
        : '<button type="button" class="btn-primary mt-5 w-full" data-action="consume" data-id="' + esc(v.id) + '">' + icon('check') + 'Consommer le bon</button>') +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Onglet Création de mission
  // ------------------------------------------------------------------------
  function renderCreate(pro) {
    if (created) {
      return '<div class="ph relative overflow-hidden rounded-[2rem] text-snow-100">' + photo(created, { sizes: '700px', alt: '' }) +
        '<div class="absolute inset-0 bg-fir-950/60"></div><div class="relative p-8 sm:p-10">' +
        '<span class="flex h-12 w-12 items-center justify-center rounded-full bg-larch-400 text-fir-900">' + icon('check', 'h-6 w-6') + '</span>' +
        '<h2 class="mt-5 text-5xl leading-none">Mission <em class="text-larch-300">publiée</em>&nbsp;!</h2>' +
        '<p class="mt-2 text-snow-200/90">« ' + esc(created.title) + ' » est visible dès maintenant dans le catalogue, avec sa contrepartie&nbsp;: ' + esc(created.reward.title) + '.</p>' +
        '<div class="mt-6 flex flex-col gap-3 sm:flex-row">' +
          '<a href="#/missions?focus=' + esc(created.id) + '" class="btn-accent">Voir dans le catalogue ' + icon('arrow') + '</a>' +
          '<button type="button" class="btn-glass" data-action="new-mission">Créer une autre mission</button>' +
        '</div>' +
      '</div></div>';
    }

    const { SEASONS, TYPES } = Meleze.data;
    return '<form class="space-y-6" data-form="create">' +
      '<fieldset class="card space-y-5 p-5 sm:p-7">' +
        '<legend class="float-left mb-1 w-full font-serif text-3xl"><span class="text-muted">01</span> La mission</legend>' +
        field('title', 'Intitulé', '<input class="field" id="title" name="title" required maxlength="80" placeholder="Ex. Nettoyer les berges du Doron">') +
        field('type', 'Type', '<select class="field" id="type" name="type" required>' + TYPES.map((t) => '<option value="' + t.id + '">' + t.label + '</option>').join('') + '</select>') +
        '<div><p class="label" id="seasons-l">Saison(s)</p><div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="seasons-l">' +
          SEASONS.map((s) => '<label class="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 has-[:checked]:border-ink has-[:checked]:bg-card">' +
            '<input type="checkbox" name="seasons" value="' + s.id + '" class="h-5 w-5 accent-[#1B3A2D]">' + s.label + '</label>').join('') +
        '</div></div>' +
        '<div class="grid grid-cols-2 gap-4">' +
          field('duration', 'Durée', '<select class="field" id="duration" name="duration">' + DURATIONS.map((d) => '<option value="' + d + '"' + (d === 90 ? ' selected' : '') + '>' + duration(d) + '</option>').join('') + '</select>') +
          field('spots', 'Places', '<input class="field" id="spots" name="spots" type="number" min="1" max="500" value="10" required inputmode="numeric">') +
        '</div>' +
        field('location', 'Lieu de rendez-vous', '<input class="field" id="location" name="location" required placeholder="Ex. Pont de la Pêche">') +
        field('schedule', 'Quand ?', '<input class="field" id="schedule" name="schedule" placeholder="Ex. Samedi · 9h30">') +
        field('description', 'Description', '<textarea class="field min-h-[7rem]" id="description" name="description" required maxlength="400" placeholder="Ce que les participants vont faire, le matériel à prévoir…"></textarea>') +
      '</fieldset>' +

      // Contrepartie : bloc mis en avant, champs obligatoires
      '<fieldset class="space-y-5 rounded-[1.75rem] bg-accent/15 p-5 ring-2 ring-accent sm:p-7">' +
        '<legend class="float-left mb-1 flex w-full flex-wrap items-center gap-3 font-serif text-3xl"><span class="text-accent-ink">02</span> La contrepartie <span class="badge bg-accent font-sans text-on-accent">Obligatoire</span></legend>' +
        '<p class="text-sm text-muted">Pas de mission sans récompense&nbsp;: c’est la promesse Mélèze.</p>' +
        field('rtitle', 'Récompense offerte', '<input class="field" id="rtitle" name="rtitle" required maxlength="80" placeholder="Ex. Une descente en luge offerte">') +
        field('rpartner', 'Offerte par', '<input class="field" id="rpartner" name="rpartner" required value="' + esc(pro.org) + '">') +
        field('rcat', 'Catégorie', '<select class="field" id="rcat" name="rcat">' + CATEGORIES.map((c) => '<option>' + c + '</option>').join('') + '</select>') +
        '<label class="flex cursor-pointer items-start gap-3 text-sm font-semibold"><input type="checkbox" name="commit" required class="mt-0.5 h-5 w-5 shrink-0 accent-[#1B3A2D]">Je m’engage à honorer cette contrepartie pour chaque mission validée.</label>' +
      '</fieldset>' +

      '<button class="btn-primary w-full">Publier dans le catalogue <span class="btn-arrow">' + icon('arrow', 'h-4 w-4') + '</span></button>' +
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
        flash = 'Mission validée. Bon <span class="font-mono">' + esc(v.code) + '</span> envoyé dans le wallet du participant&nbsp;: ' + esc(v.title) + '.';
        toast('Mission validée, récompense débloquée !');
      }
      app.rerender();
    },
    consume(el, app) {
      const v = store.consume(el.dataset.id);
      if (v) { flash = null; toast('Bon consommé. Bonne expérience !'); }
      app.rerender();
    },
    'new-mission'(el, app) { created = null; app.rerender(); },
  };

  const forms = {
    login(form, app) {
      const f = new FormData(form);
      const demo = Meleze.data.proDemo;
      if (String(f.get('pin')) !== demo.pin) {
        toast('Code PIN incorrect (démo : ' + demo.pin + ')', 'error');
        form.pin.focus();
        return;
      }
      if (!String(f.get('org')).trim()) { form.org.focus(); return; }
      store.login({ email: String(f.get('email')), role: String(f.get('role')), org: String(f.get('org')).trim() });
      toast('Bienvenue dans l’espace partenaires');
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
