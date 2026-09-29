'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const Registration = require('../models/Registration');
const { nextSequence } = require('../models/Counter');
const { validateRegistration } = require('../lib/validation');
const { getPublicStats, listRegistrations, getAdminData } = require('../lib/registrationsService');
const { fetchForExport, toCsv, toExcelHtml, timestampName } = require('../lib/export');
const { requireAdmin, verifyToken } = require('../middleware/auth');
const hub = require('../lib/eventsHub');
const config = require('../config');
const { INSCRIPTION_PREFIX, COUNTER_KEY, INVITE_PAR, POINTS_RAMASSAGE, PRESENCE_CHOICES } = require('../config/event');

const router = express.Router();

/**
 * Anti-spam : limite uniquement la creation d'inscriptions (POST).
 * Un admin authentifie n'est jamais limite.
 */
const registrationLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => Boolean(verifyToken(req)),
  message: {
    ok: false,
    message: 'Trop de tentatives depuis cet appareil. Merci de reessayer plus tard.',
  },
});

/** Genere le prochain numero d'inscription unique : EXPHA-2026-0001 */
async function generateNumero() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const seq = await nextSequence(COUNTER_KEY);
    const numero = `${INSCRIPTION_PREFIX}-${String(seq).padStart(4, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    const existe = await Registration.exists({ numeroInscription: numero });
    if (!existe) return numero;
  }
  // Filet de securite : suffixe aleatoire si le compteur est incoherent
  return `${INSCRIPTION_PREFIX}-${Date.now().toString(36).toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/*  POST /api/registrations  -  inscription (public)                    */
/* ------------------------------------------------------------------ */
router.post('/', registrationLimiter, async (req, res, next) => {
  try {
    const { ok, value, errors } = validateRegistration(req.body);
    if (!ok) {
      return res.status(400).json({
        ok: false,
        message: 'Certains champs sont invalides ou manquants.',
        errors,
      });
    }

    const numeroInscription = await generateNumero();

    const registration = await Registration.create({ ...value, numeroInscription });

    // Notification temps reel de l'espace admin
    hub.broadcast('registration', { registration, total: await Registration.countDocuments({}) });

    return res.status(201).json({
      ok: true,
      message: 'Votre inscription a bien été enregistrée. Merci et à bientôt !',
      data: {
        numeroInscription: registration.numeroInscription,
        nom: registration.nom,
        prenom: registration.prenom,
        telephone: registration.telephone,
        structureMedicale: registration.structureMedicale,
        invitePar: registration.invitePar,
        pointRamassage: registration.pointRamassage,
        presence: registration.presence,
        createdAt: registration.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/registrations/config  -  options des listes (public)        */
/* ------------------------------------------------------------------ */
router.get('/config', (req, res) => {
  res.json({
    ok: true,
    data: { invitePar: INVITE_PAR, pointRamassage: POINTS_RAMASSAGE, presence: PRESENCE_CHOICES },
  });
});

/* ------------------------------------------------------------------ */
/*  GET /api/registrations/stats  -  compteur public                     */
/* ------------------------------------------------------------------ */
router.get('/stats', async (req, res, next) => {
  try {
    const data = await getPublicStats();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/registrations  -  liste filtree (admin)                    */
/* ------------------------------------------------------------------ */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const data = await listRegistrations(req.query);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/registrations/dashboard  -  liste + stats + valeurs (admin) */
/* ------------------------------------------------------------------ */
router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const data = await getAdminData(req.query);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/registrations/export.csv  |  /export.xls  (admin)           */
/* ------------------------------------------------------------------ */
router.get('/export.csv', requireAdmin, async (req, res, next) => {
  try {
    const items = await fetchForExport(req.query);
    const name = `inscrits-expha-17-octobre-2026-${timestampName()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(toCsv(items));
  } catch (err) {
    next(err);
  }
});

router.get('/export.xls', requireAdmin, async (req, res, next) => {
  try {
    const items = await fetchForExport(req.query);
    const name = `inscrits-expha-17-octobre-2026-${timestampName()}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(toExcelHtml(items));
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/registrations/:id  (admin)                              */
/* ------------------------------------------------------------------ */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await Registration.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Inscription introuvable.' });
    hub.broadcast('deletion', { id: req.params.id, total: await Registration.countDocuments({}) });
    return res.json({ ok: true, message: 'Inscription supprimee.', id: req.params.id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
