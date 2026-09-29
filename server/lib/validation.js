'use strict';

const {
  INVITE_PAR,
  POINTS_RAMASSAGE,
  INVITE_PAR_MAP,
  POINTS_RAMASSAGE_MAP,
  canonicalFrom,
} = require('../config/event');

/** Supprime les espaces multiples et les caracteres de controle. */
function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise un numero de telephone senegalais / international.
 * Accepte : 77 123 45 67 | +221771234567 | 00221771234567 | 771234567
 */
function cleanPhone(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('221') && digits.length > 9) digits = digits.slice(3);
  return digits;
}

function isValidPhone(digits) {
  // 9 chiffres, prefixes mobile/fixe usuels au Senegal (6, 7) + 00221 geres plus haut
  return /^[0-9]{9}$/.test(digits) && /^[67]/.test(digits);
}

/**
 * Valide et normalise une inscription.
 * @returns {{ ok: true, value: object } | { ok: false, errors: Record<string,string> }}
 */
function validateRegistration(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const errors = {};
  const value = {};

  value.nom = cleanText(body.nom);
  if (!value.nom) errors.nom = 'Le nom est obligatoire.';
  else if (value.nom.length < 2) errors.nom = 'Le nom doit contenir au moins 2 caracteres.';
  else if (value.nom.length > 80) errors.nom = 'Le nom ne doit pas depasser 80 caracteres.';

  value.prenom = cleanText(body.prenom);
  if (!value.prenom) errors.prenom = 'Le prenom est obligatoire.';
  else if (value.prenom.length < 2) errors.prenom = 'Le prenom doit contenir au moins 2 caracteres.';
  else if (value.prenom.length > 80) errors.prenom = 'Le prenom ne doit pas depasser 80 caracteres.';

  const phone = cleanPhone(body.telephone);
  if (!cleanText(body.telephone)) errors.telephone = 'Le numero de telephone est obligatoire.';
  else if (!isValidPhone(phone)) {
    errors.telephone = 'Numero invalide. Exemple : 77 123 45 67 ou +221 77 123 45 67';
  } else {
    value.telephone = phone;
  }

  value.structureMedicale = cleanText(body.structureMedicale);
  if (!value.structureMedicale) {
    errors.structureMedicale = 'La structure medicale est obligatoire.';
  } else if (value.structureMedicale.length > 160) {
    errors.structureMedicale = 'La structure medicale ne doit pas depasser 160 caracteres.';
  }

  const invitePar = canonicalFrom(body.invitePar, INVITE_PAR_MAP);
  if (!cleanText(body.invitePar)) errors.invitePar = 'Merci de choisir un invitant.';
  else if (!invitePar) {
    errors.invitePar = `Valeur invalide. Options : ${INVITE_PAR.join(', ')}`;
  } else {
    value.invitePar = invitePar;
  }

  const pointRamassage = canonicalFrom(body.pointRamassage, POINTS_RAMASSAGE_MAP);
  if (!cleanText(body.pointRamassage)) {
    errors.pointRamassage = 'Merci de choisir un point de ramassage.';
  } else if (!pointRamassage) {
    errors.pointRamassage = `Valeur invalide. Options : ${POINTS_RAMASSAGE.join(', ')}`;
  } else {
    value.pointRamassage = pointRamassage;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

module.exports = { cleanText, cleanPhone, isValidPhone, validateRegistration };
