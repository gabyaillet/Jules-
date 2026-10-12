/* ==========================================================================
   Mélèze — photothèque
   Chaque entrée est soit un identifiant Unsplash (licence Unsplash : usage
   gratuit, commercial compris), soit un chemin local (ex. "img/lac.webp").
   ➜ Pour mettre de vraies photos de Pralognan, déposez-les dans img/ et
     remplacez simplement `src` ci-dessous : rien d'autre à modifier.
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.photos = {
  hero:    { src: '1506905925346-21bda4d32df4', alt: 'Sommets alpins émergeant d’une mer de nuages' },
  peak:    { src: '1454496522488-7a8e488e8606', alt: 'Sommet enneigé sous un ciel clair' },
  range:   { src: '1464822759023-fed622ff2c3b', alt: 'Chaîne de montagnes au crépuscule' },
  lake:    { src: '1501785888041-af3ef285b470', alt: 'Lac de montagne aux eaux turquoise' },
  forest:  { src: '1441974231531-c6227db76b6e', alt: 'Lumière dorée entre les arbres d’une forêt' },
  mist:    { src: '1470071459604-3b5ec3a7fe05', alt: 'Collines boisées dans la brume du matin' },
  stars:   { src: '1519681393784-d120267933ba', alt: 'Montagne enneigée sous un ciel étoilé' },
  meadow:  { src: '1472214103451-9374bd1c798e', alt: 'Prairie verdoyante et collines au soleil' },
  valley:  { src: '1426604966848-d7adac402bff', alt: 'Vallée de montagne, forêt et falaises' },
  sunbeam: { src: '1469474968028-56623f02e42e', alt: 'Rayons de soleil sur une vallée' },

  // Photos des 3 missions (fichiers locaux fournis par le client, dossier img/)
  sentiers:    { src: 'img/sentiers.webp', alt: 'Randonneur au bord d’un lac de montagne gelé, sous des sommets enneigés' },
  covoiturage: { src: 'img/covoiturage.webp', alt: 'Quatre randonneurs sac au dos face à un lac de montagne' },
  marche:      { src: 'img/marche.webp', alt: 'Étal de fruits et légumes d’un marché vu du dessus' },
};

/** Photo par défaut selon le type (missions créées par les pros). */
Meleze.photos.byType = {
  mobilite: 'covoiturage',
  village: 'marche',
  nature: 'sentiers',
};

/* ==========================================================================
   Vidéo de fond de l'accueil (ordinateur). null = pas de vidéo : la photo HD
   s'affiche avec un lent zoom. Avec une vidéo, l'image fixe (poster) sert de
   fond pendant le chargement. Pour activer : déposer les fichiers dans
   video/ et renseigner par ex. :
   Meleze.media = { heroVideo: { webm: 'video/hero.webm', mp4: 'video/hero.mp4', poster: 'video/hero.jpg' } };
   ========================================================================== */
// Vidéo drone fournie par le client (forêt enneigée puis sommets), 9,4 s en aller-retour
// pour une boucle sans saut ; 1600 × 900, sans son, ~2,2 Mo. Image fixe tirée de la vidéo.
Meleze.media = { heroVideo: { webm: 'video/hero.webm', mp4: 'video/hero.mp4', poster: 'video/hero.jpg' } };
