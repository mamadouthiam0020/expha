'use strict';

/**
 * Constantes de l'evenement.
 * Une seule source de verite pour le backend ET le frontend.
 * Les libelles sont ceux de l'organisateur (encodage UTF-8).
 */
const EVENT = {
  title: 'JOURNÉE DE FORMATION ET DE DÉTENTE',
  dateLabel: '17 OCTOBRE 2026',
  dateISO: '2026-10-17',
  location: 'Hôtel Africa Queen – Somone',
  organizer: 'EXPHA',
  speaker: 'Professeur Bamba Ndiaye',
};

const INVITE_PAR = [
  'Maixent Dione',
  'Mme Gaye Khady Sokhna',
  'Mme Maguette Diop',
  'Mme Sow Aminata',
  'Mme Niang Cor',
];

/** Anciens libelles -> libelle actuel (migrate au demarrage du serveur). */
const INVITE_PAR_LEGACY = new Map([['Maguette Diop', 'Mme Maguette Diop']]);

const POINTS_RAMASSAGE = [
  'Terminus DEM DIK-HLM GRAND YOFF',
  'EDK Pikine',
  'Sortie 9 – Sedima',
];

/** Anciens libelles -> libelle actuel (migrate au demarrage du serveur). */
const POINTS_RAMASSAGE_LEGACY = new Map([
  ['Terminus Dem Dikk', POINTS_RAMASSAGE[0]],
  ['Terminus Dem Dik', POINTS_RAMASSAGE[0]],
  ['HLM Grand-Yoff', POINTS_RAMASSAGE[0]],
  ['HLM Grand Yoff', POINTS_RAMASSAGE[0]],
  ['EDK Pikine – Sortie 9 – Sedima', 'EDK Pikine'],
]);

/** Reponses possibles a la confirmation de presence. */
const PRESENCE_CHOICES = ['Oui', 'Non'];
const PRESENCE_DEFAUT = 'Oui';

const INSCRIPTION_PREFIX = 'EXPHA-2026';
const COUNTER_KEY = 'registration';

/** Normalise pour comparer sans se soucier des espaces, casse ou tirets. */
function normalizeLabel(value) {
  return String(value || '')
    .replace(/[\u2010-\u2015\u2212]/g, '-') // tous les types de tirets -> "-"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const INVITE_PAR_MAP = new Map([
  ...INVITE_PAR.map((v) => [normalizeLabel(v), v]),
  ...[...INVITE_PAR_LEGACY].map(([ancien, actuel]) => [normalizeLabel(ancien), actuel]),
]);
const POINTS_RAMASSAGE_MAP = new Map(POINTS_RAMASSAGE.map((v) => [normalizeLabel(v), v]));
const PRESENCE_MAP = new Map(PRESENCE_CHOICES.map((v) => [normalizeLabel(v), v]));

/** Retourne le libelle canonique, ou undefined si hors liste. */
function canonicalFrom(value, map) {
  return map.get(normalizeLabel(value));
}

const CIVILITE_FEMININE = /^(mme|mlle|mr|madame|mademoiselle)\b[\s.]*/i;
const CIVILITE_MASCULINE = /^m\.\s*/i;

/**
 * Libelle d'un invitant avec civilite.
 * Regle de l'organisateur : le nom commence par M -> "M.", sinon -> "Mme".
 * Les civilites deja presentes dans la valeur sont remplacees, pas doublees.
 */
function formatInviter(value) {
  const nom = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!nom) return '';

  const sansFeminin = nom.replace(CIVILITE_FEMININE, '').trim();
  if (sansFeminin && sansFeminin !== nom) return `Mme ${sansFeminin}`;

  const sansMasculin = nom.replace(CIVILITE_MASCULINE, '').trim();
  if (sansMasculin && sansMasculin !== nom) return `M. ${sansMasculin}`;

  return /^m/i.test(nom) ? `M. ${nom}` : `Mme ${nom}`;
}

module.exports = {
  EVENT,
  INVITE_PAR,
  INVITE_PAR_LEGACY,
  POINTS_RAMASSAGE,
  POINTS_RAMASSAGE_LEGACY,
  PRESENCE_CHOICES,
  PRESENCE_DEFAUT,
  INSCRIPTION_PREFIX,
  COUNTER_KEY,
  normalizeLabel,
  canonicalFrom,
  formatInviter,
  INVITE_PAR_MAP,
  POINTS_RAMASSAGE_MAP,
  PRESENCE_MAP,
};
