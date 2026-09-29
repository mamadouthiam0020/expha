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
  'Maguette Diop',
  'Mme Sow Aminata',
  'Mme Niang Cor',
];

const POINTS_RAMASSAGE = [
  'Terminus Dem Dikk',
  'EDK Pikine',
  'Sortie 9 – Sedima',
  'HLM Grand-Yoff',
];

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

const INVITE_PAR_MAP = new Map(INVITE_PAR.map((v) => [normalizeLabel(v), v]));
const POINTS_RAMASSAGE_MAP = new Map(POINTS_RAMASSAGE.map((v) => [normalizeLabel(v), v]));

/** Retourne le libelle canonique, ou undefined si hors liste. */
function canonicalFrom(value, map) {
  return map.get(normalizeLabel(value));
}

module.exports = {
  EVENT,
  INVITE_PAR,
  POINTS_RAMASSAGE,
  INSCRIPTION_PREFIX,
  COUNTER_KEY,
  normalizeLabel,
  canonicalFrom,
  INVITE_PAR_MAP,
  POINTS_RAMASSAGE_MAP,
};
