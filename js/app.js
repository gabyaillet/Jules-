/* ==========================================================================
   Mélèze — application : routeur par hash, délégation d'événements, thème
   Routes :
     #/              Accueil touriste
     #/missions      Catalogue (?focus=<id> pour cibler une mission)
     #/wallet        Profil / wallet
     #/pro           Espace partenaire (#/pro/scan, #/pro/creer)
   ========================================================================== */
(function () {
  'use strict';
  const { views, store, ui } = Meleze;

  const ROUTES = { '': views.home, missions: views.catalogue, wallet: views.wallet, pro: views.pro };
  const root = document.getElementById('app');
  let route = parse();
  let queued = false;

  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const [name, sub] = (path || '').split('/');
    return {
      name: ROUTES[name] ? name : '',
      sub: sub || '',
      params: Object.fromEntries(new URLSearchParams(query || '')),
    };
  }

  // ------------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------------
  /** Clé permettant de retrouver l'élément focalisé après un nouveau rendu. */
  function focusKey(el) {
    if (!el || !el.dataset || !el.dataset.action) return null;
    return ['action', 'id', 'group', 'value', 'code']
      .filter((k) => el.dataset[k] != null)
      .map((k) => '[data-' + k + '="' + CSS.escape(el.dataset[k]) + '"]').join('');
  }

  function render(isNavigation) {
    const view = ROUTES[route.name];
    const key = isNavigation ? null : focusKey(document.activeElement);

    root.innerHTML = view.render(store.state, route.params, route.sub);
    document.title = view.title + ' · Mélèze';
    updateChrome();

    if (isNavigation) {
      window.scrollTo(0, 0);
      const h = document.getElementById('page-title');
      if (h) h.focus({ preventScroll: true }); // annonce la nouvelle page aux lecteurs d'écran
    } else if (key) {
      const again = root.querySelector(key);
      if (again) again.focus({ preventScroll: true });
    }
    if (view.mounted) view.mounted(root, route.params);
  }

  /** Regroupe les rendus déclenchés dans la même frame (store + action). */
  function scheduleRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(false); });
  }

  /** Met à jour la navigation (onglet actif) et masque la barre basse en mode pro. */
  function updateChrome() {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === route.name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const isPro = route.name === 'pro';
    document.getElementById('tabbar').hidden = isPro;
    document.getElementById('pro-badge').hidden = !isPro;
  }

  const app = {
    rerender: scheduleRender,
    go(hash) { if (location.hash === hash) render(true); else location.hash = hash; },
  };

  // ------------------------------------------------------------------------
  // Thème clair / sombre (sombre = économie d'énergie sur OLED)
  // ------------------------------------------------------------------------
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('meleze:theme', theme); } catch (e) { /* rien */ }
    const btn = document.getElementById('theme-toggle');
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.innerHTML = ui.icon(dark ? 'sun' : 'moon') + '<span class="sr-only">Mode sombre économe en énergie</span>';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0C0E0D' : '#FFFFFF';
  }

  const globalActions = {
    theme() { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); },
  };

  // ------------------------------------------------------------------------
  // Délégation d'événements : un seul écouteur pour toute l'application
  // ------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const view = ROUTES[route.name];
    const fn = (view.actions && view.actions[el.dataset.action]) || globalActions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, app); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const view = ROUTES[route.name];
    const fn = view.forms && view.forms[form.dataset.form];
    if (fn) fn(form, app);
  });

  // Photo introuvable (hors-ligne, lien mort) : on la masque, le fond sauge
  // du conteneur .ph prend le relais. Capture = marche aussi pour <img>.
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') e.target.style.visibility = 'hidden';
  }, true);

  window.addEventListener('hashchange', () => { route = parse(); render(true); });
  store.subscribe(scheduleRender);

  // ------------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------------
  setTheme(document.documentElement.dataset.theme || 'light');
  document.getElementById('year').textContent = new Date().getFullYear();
  render(false);

  // PWA : cache hors-ligne (uniquement servi en http/https, pas en file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
