/** Validation cote client (miroir de server/lib/validation.js). */

export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhone(value) {
  let digits = cleanText(value).replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('221') && digits.length > 9) digits = digits.slice(3);
  return digits;
}

/** Groupes du format lisible : XX XXX XX XX */
const PHONE_GROUPES = [2, 3, 2, 2];

export function formatPhoneInput(value) {
  // Affichage lisible pendant la saisie : 77 123 45 67
  // (les prefixes 00221 / +221 / 221 saisis sont absorbes)
  let digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('221') && digits.length > 9) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (!digits) return '';

  const parts = [];
  let reste = digits;
  for (const taille of PHONE_GROUPES) {
    if (!reste) break;
    parts.push(reste.slice(0, taille));
    reste = reste.slice(taille);
  }
  return parts.join(' ');
}

/**
 * @returns {object} objet d'erreurs (vide si tout est valide)
 */
export function validateRegistration(values, options = {}) {
  const { invitePar = [], pointRamassage = [], presence = [] } = options;
  const errors = {};

  const nom = cleanText(values.nom);
  if (!nom) errors.nom = 'Le nom est obligatoire.';
  else if (nom.length < 2) errors.nom = 'Le nom doit contenir au moins 2 caractères.';
  else if (nom.length > 80) errors.nom = 'Le nom ne doit pas dépasser 80 caractères.';

  const prenom = cleanText(values.prenom);
  if (!prenom) errors.prenom = 'Le prénom est obligatoire.';
  else if (prenom.length < 2) errors.prenom = 'Le prénom doit contenir au moins 2 caractères.';
  else if (prenom.length > 80) errors.prenom = 'Le prénom ne doit pas dépasser 80 caractères.';

  if (!cleanText(values.telephone)) errors.telephone = 'Le numéro de téléphone est obligatoire.';
  else {
    const digits = normalizePhone(values.telephone);
    if (!/^[0-9]{9}$/.test(digits) || !/^[67]/.test(digits)) {
      errors.telephone = 'Numéro invalide. Exemple : 77 123 45 67';
    }
  }

  const structure = cleanText(values.structureMedicale);
  if (!structure) errors.structureMedicale = 'La structure médicale est obligatoire.';
  else if (structure.length > 160) errors.structureMedicale = 'Maximum 160 caractères.';

  if (!cleanText(values.invitePar)) errors.invitePar = 'Merci de choisir un invitant.';
  else if (invitePar.length && !invitePar.includes(values.invitePar)) {
    errors.invitePar = 'Valeur non autorisée.';
  }

  if (!cleanText(values.pointRamassage)) errors.pointRamassage = 'Merci de choisir un point de ramassage.';
  else if (pointRamassage.length && !pointRamassage.includes(values.pointRamassage)) {
    errors.pointRamassage = 'Valeur non autorisée.';
  }

  if (!cleanText(values.presence))
    errors.presence = 'Merci de répondre à la question de confirmation de présence.';
  else if (presence.length && !presence.includes(values.presence)) {
    errors.presence = 'Valeur non autorisée.';
  }

  return errors;
}

export function hasErrors(errors) {
  return Boolean(errors) && Object.keys(errors).length > 0;
}
