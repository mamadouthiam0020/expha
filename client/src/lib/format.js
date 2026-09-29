/** Helpers d'affichage (miroir de server/config/event.js). */

const CIVILITE_FEMININE = /^(mme|mlle|mr|madame|mademoiselle)\b[\s.]*/i;
const CIVILITE_MASCULINE = /^m\.\s*/i;

/**
 * Libelle d'un invitant avec civilite.
 * Regle de l'organisateur : le nom commence par M -> "M.", sinon -> "Mme".
 */
export function formatInviter(value) {
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

/** Numero de telephone lisible : 77 123 45 67. */
export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 9) return value || '';
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}
