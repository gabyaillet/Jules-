/* ==========================================================================
   Vue : Mentions légales (#/mentions-legales)
   Obligatoires pour tout site publié en France (loi n° 2004-575 du 21 juin
   2004 pour la confiance dans l'économie numérique, « LCEN ») : qui édite le
   site, qui en est responsable, qui l'héberge ; plus les crédits et la façon
   dont les données personnelles sont traitées (RGPD).

   >>> À COMPLÉTER : les informations de l'éditeur ci-dessous (EDITEUR).
   Un champ laissé vide s'affiche « À compléter » sur la page.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.legal = (function () {
  'use strict';
  const { esc } = Meleze.ui;

  // ---- Éditeur du site : à remplir ------------------------------------------------------
  const EDITEUR = {
    nom: '', // ex. « Gabriel Martin » (particulier) ou « Association Mélèze »
    statut: '', // ex. « Particulier », « Association loi 1901 », « Micro-entreprise »
    adresse: '', // adresse postale (siège pour une association / entreprise)
    email: '', // adresse de contact (sert aussi aux demandes RGPD)
    telephone: '', // obligatoire pour une association ou une entreprise
    siret: '', // si l'éditeur est immatriculé (sinon, laisser vide et retirer la ligne)
    directeur: '', // directeur·rice de la publication (souvent la même personne)
    photos: '', // auteur ou source des photos du covoiturage et du marché
    video: '', // auteur ou source de la vidéo de l'accueil, ex. « Gab » ou « Pexels – Nom »
  };
  const MISE_A_JOUR = '14 octobre 2026';

  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  const H2 = 'text-3xl font-extrabold sm:text-4xl';
  const P = 'mt-4 max-w-[68ch] text-lg';
  const A = 'underline decoration-accent decoration-2 underline-offset-4 hover:text-brand-ink';

  /** Valeur saisie, ou un repère bien visible tant qu'elle manque. */
  function val(v) {
    return v ? esc(v) : '<span class="bg-sunk px-2 py-0.5 font-display font-bold text-ink">À compléter</span>';
  }
  function row(label, html) {
    return '<div class="grid gap-1 border-t border-line py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">' +
      '<dt class="font-display font-bold text-muted">' + label + '</dt>' +
      '<dd class="text-lg">' + html + '</dd>' +
    '</div>';
  }
  function link(href, text) {
    return '<a class="' + A + '" href="' + esc(href) + '" rel="noopener">' + text + '</a>';
  }
  function section(id, title, body) {
    return '<section class="mt-14 lg:mt-20" aria-labelledby="' + id + '">' +
      '<h2 id="' + id + '" class="' + H2 + '">' + title + '</h2>' + body +
    '</section>';
  }

  function render() {
    const e = EDITEUR;
    const mail = e.email ? link('mailto:' + e.email, esc(e.email)) : val('');
    return '<div class="' + WRAP + ' pb-16 pt-12 lg:pb-24 lg:pt-20">' +
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-7xl">Mentions légales</h1>' +
      '<p class="mt-4 text-muted">Dernière mise à jour : ' + MISE_A_JOUR + '</p>' +

      section('editeur', 'Éditeur du site',
        '<dl class="mt-6 max-w-3xl border-b border-line">' +
          row('Nom', val(e.nom)) +
          row('Statut', val(e.statut)) +
          row('Adresse', val(e.adresse)) +
          row('E-mail', mail) +
          row('Téléphone', val(e.telephone)) +
          row('SIRET', val(e.siret)) +
          row('Directeur·rice de la publication', val(e.directeur)) +
        '</dl>') +

      section('hebergeur', 'Hébergement',
        '<p class="' + P + '">Le site est hébergé par <strong>GitHub, Inc.</strong> (service GitHub Pages), ' +
          '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis — ' +
          link('https://support.github.com/contact', 'support.github.com/contact') + '.</p>') +

      section('demo', 'Version de démonstration',
        '<p class="' + P + '">Mélèze est un prototype. Les missions, partenaires et contreparties présentés sont des exemples : ' +
          'les bons affichés dans « Mon espace » ne peuvent pas encore être utilisés chez les commerçants.</p>') +

      section('propriete', 'Propriété intellectuelle et crédits',
        '<p class="' + P + '">Le nom Mélèze, les textes et la mise en page sont la propriété de l’éditeur. ' +
          'Toute reproduction sans autorisation est interdite.</p>' +
        '<ul class="mt-4 max-w-[68ch] list-disc space-y-2 pl-6 text-lg marker:text-accent">' +
          '<li>Photo du nettoyage des sentiers : © Randozone.com.</li>' +
          '<li>Photos du covoiturage et du marché : ' + val(e.photos) + '.</li>' +
          '<li>Autres photos : ' + link('https://unsplash.com/license', 'Unsplash') + ' (licence Unsplash).</li>' +
          '<li>Vidéo de l’accueil : ' + val(e.video) + '.</li>' +
          '<li>Polices Bricolage Grotesque et Source Sans 3 : licence SIL Open Font License 1.1.</li>' +
          '<li>Codes QR : bibliothèques « QR Code Generator » de Kazuhiko Arase (licence MIT) et jsQR (licence Apache 2.0).</li>' +
        '</ul>') +

      section('donnees', 'Données personnelles',
        '<p class="' + P + '">Dans cette version, Mélèze n’a <strong>ni compte ni serveur</strong> : ' +
          'les missions choisies, les codes de participation, les bons et les photos justificatives sont enregistrés ' +
          '<strong>uniquement dans votre navigateur</strong>, sur votre appareil. Ils ne sont envoyés ni à l’éditeur ni à des tiers.</p>' +
        '<ul class="mt-4 max-w-[68ch] list-disc space-y-2 pl-6 text-lg marker:text-accent">' +
          '<li><strong>Caméra</strong> : utilisée seulement pour lire les codes QR dans l’espace partenaires. Les images sont analysées sur l’appareil, jamais enregistrées ni envoyées.</li>' +
          '<li><strong>Espace partenaires</strong> : l’e-mail, le rôle et l’organisation saisis à la connexion restent dans l’onglet et sont effacés à sa fermeture.</li>' +
          '<li><strong>Tout effacer</strong> : bouton « Réinitialiser les données de démo » en bas de ' + link('#/wallet', 'Mon espace') + ', ou suppression des données du site dans les réglages du navigateur.</li>' +
          '<li><strong>Cookies</strong> : aucun cookie, aucune mesure d’audience, aucune publicité. Le stockage du navigateur sert uniquement au fonctionnement du site (missions, bons, thème clair ou sombre).</li>' +
          '<li><strong>Services tiers</strong> : certaines photos sont chargées depuis Unsplash, et l’hébergeur GitHub peut enregistrer l’adresse IP des visiteurs pour la sécurité du service. Comme pour toute page web, ils reçoivent alors votre adresse IP et des informations techniques sur votre navigateur.</li>' +
        '</ul>' +
        '<p class="' + P + '">Vous pouvez exercer vos droits (accès, rectification, effacement, opposition) en écrivant à l’éditeur : ' + mail + '. ' +
          'Vous pouvez aussi adresser une réclamation à la ' + link('https://www.cnil.fr/fr/plaintes', 'CNIL') + '.</p>') +
    '</div>';
  }

  return { title: 'Mentions légales', render };
})();
