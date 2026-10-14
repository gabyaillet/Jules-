/* ==========================================================================
   Vue : Mentions légales (#/mentions-legales)
   Obligatoires pour tout site publié en France (loi n° 2004-575 du 21 juin
   2004 pour la confiance dans l'économie numérique, « LCEN ») : qui édite le
   site, qui en est responsable, qui l'héberge ; plus les crédits et la façon
   dont les données personnelles sont traitées (RGPD).

   >>> À COMPLÉTER : les informations de l'éditeur ci-dessous (EDITEUR).
   Un champ laissé vide s'affiche « À compléter » sur la page.
   >>> À RELIRE avant la mise en ligne, idéalement avec un juriste : la
   partie « Données personnelles » décrit le fonctionnement technique réel
   de Mélèze (Supabase + vérification des photos par Anthropic) et les
   engagements de l'éditeur (durée de conservation…).
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
    video: '', // auteur ou source de la vidéo de l'accueil, ex. « Prénom Nom » ou « Pexels – Nom »
    telephoneHebergeur: '', // téléphone de GitHub, Inc. (la loi le demande) : à vérifier avant de le mettre
    regionDonnees: '', // région du projet Supabase (choisie à sa création), ex. « Union européenne (Francfort) »
    envoiEmails: '', // service qui envoie les codes par e-mail (SMTP réglé dans Supabase), ex. « Brevo (Sendinblue SAS, France) »
    // Garanties qui encadrent les transferts hors UE, à remplir APRÈS avoir accepté l'accord de traitement
    // (DPA) de chaque prestataire (voir supabase/README.md, « Contrats avec les prestataires »), ex.
    // « clauses contractuelles types de la Commission européenne, incluses dans l'accord de traitement de chaque prestataire »
    transferts: '',
  };

  // ---- Engagements de l'éditeur sur les données (à tenir dans la base) -----------------
  /** Données d'un participant supprimées après ce nombre de mois sans activité. */
  const CONSERVATION_MOIS = 12;
  /** Journal des vérifications photo : purgé après ce nombre de jours (entretien, supabase/README.md). */
  const JOURNAL_JOURS = 30;
  /** Nombre maximal d'essais photo par mission (voir aussi js/data.js et le serveur). */
  const ESSAIS = Meleze.data.MAX_ATTEMPTS;

  const MISE_A_JOUR = '14 octobre 2026';

  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  const H2 = 'text-3xl font-extrabold sm:text-4xl';
  const H3 = 'mt-8 text-2xl font-bold';
  const P = 'mt-4 max-w-[68ch] text-lg';
  const UL = 'mt-4 max-w-[68ch] list-disc space-y-2 pl-6 text-lg marker:text-accent';
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
      '<p class="mt-4 text-muted">Dernière mise à jour : ' + MISE_A_JOUR + '</p>' +

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
          '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis — téléphone : ' + val(e.telephoneHebergeur) + ' — ' +
          link('https://support.github.com/contact', 'support.github.com/contact') + '.</p>' +
        '<p class="' + P + '">Les données de l’application (missions, participations, bons) sont hébergées par <strong>Supabase, Inc.</strong> ' +
          '(' + link('https://supabase.com', 'supabase.com') + '), région : ' + val(e.regionDonnees) + '.</p>' +
        '<p class="' + P + '">Les codes de connexion sont envoyés par e-mail par : ' + val(e.envoiEmails) + '.</p>') +

      section('propriete', 'Propriété intellectuelle et crédits',
        '<p class="' + P + '">Le nom Mélèze, les textes et la mise en page sont la propriété de l’éditeur. ' +
          'Toute reproduction sans autorisation est interdite.</p>' +
        '<ul class="' + UL + '">' +
          '<li>Photo du nettoyage des sentiers : © Randozone.com.</li>' +
          '<li>Photos du covoiturage et du marché : ' + val(e.photos) + '.</li>' +
          '<li>Autres photos : ' + link('https://unsplash.com/license', 'Unsplash') + ' (licence Unsplash).</li>' +
          '<li>Vidéo de l’accueil : ' + val(e.video) + '.</li>' +
          '<li>Polices Bricolage Grotesque et Source Sans 3 : licence SIL Open Font License 1.1.</li>' +
          '<li>Connexion au serveur : bibliothèque supabase-js de Supabase (licence MIT).</li>' +
        '</ul>') +

      section('donnees', 'Données personnelles',
        '<p class="' + P + '">Mélèze demande le minimum : <strong>ni nom, ni mot de passe</strong> aux participants, et l’e-mail est <strong>facultatif</strong>. ' +
          'Le responsable du traitement est l’éditeur du site (voir plus haut), joignable à : ' + mail + '.</p>' +

        '<h3 class="' + H3 + '">Ce qui est traité</h3>' +
        '<ul class="' + UL + '">' +
          '<li><strong>Participants</strong> : un identifiant de compte anonyme, créé seulement quand vous vous inscrivez à une première mission et gardé dans votre navigateur ; ' +
            'vos participations (mission choisie, statut, nombre d’essais), le résultat de chaque vérification photo (validée ou non, avec une courte explication) ' +
            'et vos bons (contrepartie, code, date et heure d’utilisation). Ces données sont enregistrées dans une base de données hébergée par Supabase, Inc. (région : ' + val(e.regionDonnees) + ').</li>' +
          '<li><strong>Photo de vérification</strong> : prise dans l’application seulement quand vous appuyez sur « Prendre la photo », puis envoyée seulement quand vous appuyez sur « Valider la photo » (ou sur « Réessayer l’envoi » après une panne), ' +
            'à la fonction de vérification de Mélèze et à <strong>Anthropic</strong> (États-Unis), dont l’intelligence artificielle vérifie qu’elle montre ce que la mission demande. ' +
            'Un billet ou une réservation photographiés peuvent montrer votre nom et des détails de votre voyage : vous pouvez les cacher avant la photo. ' +
            '<strong>Mélèze ne conserve jamais la photo</strong> : seul le résultat est enregistré. Anthropic la traite pour fournir ce service, selon ses conditions applicables aux clients de son API. ' +
            'L’analyse ne cherche jamais à identifier les personnes ; évitez de photographier quelqu’un sans son accord.</li>' +
          '<li><strong>E-mail du participant (facultatif)</strong> : seulement si vous l’ajoutez dans « Mon espace » (« Gardez vos bons »). Il est lié à votre compte ' +
            'et sert uniquement à vous envoyer un code à 6 chiffres pour retrouver vos bons sur un autre appareil. Ni lettre d’information, ni publicité.</li>' +
          '<li><strong>Partenaires</strong> : adresse e-mail professionnelle (connexion par code reçu par e-mail), nom de l’organisation et missions publiées.</li>' +
          '<li><strong>Données techniques</strong> : comme pour toute page web, GitHub (hébergement du site), Supabase et Unsplash (certaines photos) reçoivent votre adresse IP ' +
            'et des informations techniques sur votre navigateur, pour fournir le service et en assurer la sécurité.</li>' +
        '</ul>' +

        '<h3 class="' + H3 + '">Pourquoi, et sur quelle base</h3>' +
        '<ul class="' + UL + '">' +
          '<li>Faire fonctionner le service que vous demandez (inscription à une mission, vérification de la photo, émission et utilisation des bons, sauvegarde des bons avec votre e-mail si vous le choisissez ; ' +
            'connexion et publication de missions pour les partenaires) : exécution du contrat ou de mesures précontractuelles prises à votre demande (article 6.1.b du RGPD).</li>' +
          '<li>Sécurité et prévention des abus (au plus ' + ESSAIS + ' essais photo par mission, nombre de vérifications limité par jour, un seul bon par mission et par compte, journaux techniques) : ' +
            'intérêt légitime de l’éditeur (article 6.1.f du RGPD).</li>' +
        '</ul>' +

        '<h3 class="' + H3 + '">Combien de temps</h3>' +
        '<ul class="' + UL + '">' +
          '<li>Participations et bons : jusqu’à ce que vous les supprimiez avec le bouton « Supprimer mes données », ' +
            'et au plus ' + CONSERVATION_MOIS + ' mois après votre dernière activité. C’est un engagement de l’éditeur.</li>' +
          '<li>Journal des vérifications photo (date, mission, résultat, courte explication) : ' + JOURNAL_JOURS + ' jours. ' +
            '« Supprimer mes données » en efface aussitôt l’explication et le lien avec vos participations ; le reste sert aux limites anti-abus jusqu’au bout de ces ' + JOURNAL_JOURS + ' jours.</li>' +
          '<li>Liste des missions qui vous ont déjà valu un bon (une mission ne donne qu’un bon par compte) : tant que votre compte existe, et au plus ' + CONSERVATION_MOIS + ' mois après votre dernière activité.</li>' +
          '<li>E-mail du participant : tant que votre compte existe, et au plus ' + CONSERVATION_MOIS + ' mois après votre dernière activité ; supprimé plus tôt sur simple demande à l’éditeur.</li>' +
          '<li>Photo de vérification : jamais conservée par Mélèze.</li>' +
          '<li>Comptes partenaires : pendant la durée du partenariat, puis supprimés sur demande. Leurs missions sont alors retirées du catalogue, ' +
            'mais gardées sans lien avec le compte : les bons déjà reçus par les participants restent valables.</li>' +
          '<li>Journaux techniques de GitHub, Supabase et Unsplash : selon leurs propres règles.</li>' +
        '</ul>' +

        '<h3 class="' + H3 + '">Qui y a accès</h3>' +
        '<p class="' + P + '">L’éditeur et ses sous-traitants techniques : <strong>Supabase, Inc.</strong> (base de données, connexion, fonction de vérification), ' +
          '<strong>Anthropic</strong> (vérification de la photo), <strong>GitHub, Inc.</strong> (hébergement du site) et le service d’envoi des e-mails (' + val(e.envoiEmails) + '). ' +
          'Les partenaires ne voient que les bons que vous leur montrez. Aucune donnée n’est vendue ni utilisée pour de la publicité.</p>' +

        '<h3 class="' + H3 + '">Transferts hors de l’Union européenne</h3>' +
        '<p class="' + P + '">Supabase, Anthropic et GitHub sont des sociétés américaines, et le service d’envoi des e-mails (' + val(e.envoiEmails) + ') peut l’être aussi : ' +
          'des données peuvent être traitées aux États-Unis. Garanties qui encadrent ces transferts : ' + val(e.transferts) + '.</p>' +

        '<h3 class="' + H3 + '">Cookies et stockage du navigateur</h3>' +
        '<p class="' + P + '">Aucun cookie, aucune mesure d’audience, aucune publicité. Le stockage du navigateur sert uniquement au fonctionnement du site : ' +
          'l’identifiant de votre compte (anonyme, ou lié à votre e-mail si vous l’avez ajouté), la session des partenaires, une copie des dernières données pour l’usage hors connexion et le thème clair ou sombre.</p>' +

        '<h3 class="' + H3 + '">Vos droits</h3>' +
        '<p class="' + P + '">Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation et d’opposition, ainsi que du droit à la portabilité lorsqu’il s’applique. ' +
          'Le bouton <strong>« Supprimer mes données »</strong>, en bas de ' + link('#/wallet', 'Mon espace') + ', efface aussitôt vos participations et vos bons, retire l’explication de chaque vérification photo ' +
          '(le reste du journal sert aux limites anti-abus, voir « Combien de temps »), ' +
          'et ce navigateur oublie votre identifiant. Pour supprimer aussi votre adresse e-mail, ou pour toute autre demande, écrivez à l’éditeur : ' + mail + '. ' +
          'Vous pouvez aussi adresser une réclamation à la ' + link('https://www.cnil.fr/fr/plaintes', 'CNIL') + '.</p>') +
    '</div>';
  }

  return { title: 'Mentions légales', render };
})();
