'use strict';

const Registration = require('../models/Registration');
const { normalizeLabel } = require('../config/event');

const FILTERABLE = ['invitePar', 'pointRamassage', 'structureMedicale', 'presence'];
/** Listes comparees telles quelles (pas de normalisation de libelle). */
const EXACT_FILTERABLE = ['structureMedicale', 'presence'];
const SORTABLE = {
  createdAt: { createdAt: 1 },
  createdAtDesc: { createdAt: -1 },
  nom: { nom: 1, prenom: 1 },
  nomDesc: { nom: -1, prenom: -1 },
  numeroInscription: { numeroInscription: 1 },
  numeroInscriptionDesc: { numeroInscription: -1 },
};

/** Echappe une valeur utilisee dans une regex Mongo. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Construit le filtre Mongo a partir des query params de l'API admin.
 * Supporte : q (recherche), invitePar, pointRamassage, structureMedicale, presence,
 * inviteParList / pointRamassageList (filtres multiples), from, to.
 */
function buildFilter(query = {}) {
  const filter = {};

  const search = String(query.q || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search.slice(0, 80)), 'i');
    filter.$or = [{ nom: rx }, { prenom: rx }, { telephone: rx }, { numeroInscription: rx }];
  }

  FILTERABLE.forEach((field) => {
    const values = []
      .concat(query[field] || [])
      .concat(query[`${field}List`] || [])
      .flatMap((v) => String(v).split('~'))
      .map((v) => v.trim())
      .filter(Boolean);

    if (values.length === 0) return;

    if (EXACT_FILTERABLE.includes(field)) {
      filter[field] = { $in: values };
      return;
    }
    // Libelles : comparaison normalisee via regex (insensible a la casse / tirets)
    const alternatives = values.map((v) => new RegExp(`^${escapeRegex(normalizeLabel(v))}$`, 'i'));
    filter[field] = alternatives.length === 1 ? alternatives[0] : { $in: alternatives };
  });

  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  return filter;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildSort(query = {}) {
  const key = String(query.sort || 'createdAtDesc');
  return SORTABLE[key] || SORTABLE.createdAtDesc;
}

async function listRegistrations(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 5000);
  const page = Math.max(Number(query.page) || 1, 1);
  const filter = buildFilter(query);

  const [items, total, filteredCount] = await Promise.all([
    Registration.find(filter)
      .sort(buildSort(query))
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: false }),
    Registration.countDocuments({}),
    Registration.countDocuments(filter),
  ]);

  return { items, total, filteredCount, page, limit };
}

/** Repartition par valeur d'un champ : une seule requete agregee au lieu d'un compte par valeur. */
async function groupCounts(field) {
  const rows = await Registration.aggregate([
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((row) => ({ value: row._id, count: row.count }));
}

/** Statistiques calculees sur la liste filtree + valeurs distinctes pour les filtres. */
async function getAdminData(query = {}) {
  const filter = buildFilter(query);
  const [
    items,
    total,
    filteredCount,
    invitePar,
    pointRamassage,
    structures,
    presences,
    dernieres,
    parInvite,
    parPoint,
    parPresence,
  ] = await Promise.all([
    Registration.find(filter).sort(buildSort(query)).limit(5000).lean(),
    Registration.countDocuments({}),
    Registration.countDocuments(filter),
    Registration.distinct('invitePar'),
    Registration.distinct('pointRamassage'),
    Registration.distinct('structureMedicale'),
    Registration.distinct('presence'),
    Registration.find({}).sort({ createdAt: -1 }).limit(1).lean(),
    groupCounts('invitePar'),
    groupCounts('pointRamassage'),
    groupCounts('presence'),
  ]);

  return {
    items,
    total,
    filteredCount,
    dernieresInscription: dernieres[0] || null,
    valeurs: { invitePar, pointRamassage, structures: structures.sort(), presence: presences },
    repartition: { parInvite, parPoint, parPresence },
  };
}

/** Compteur public (page d'accueil) : nombre d'inscrits + places restantes. */
async function getPublicStats() {
  const [total, dernieres] = await Promise.all([
    Registration.countDocuments({}),
    Registration.find({}).sort({ createdAt: -1 }).limit(1).lean(),
  ]);
  return { total, derniere: dernieres[0] || null };
}

module.exports = { buildFilter, buildSort, listRegistrations, getAdminData, getPublicStats, FILTERABLE };
