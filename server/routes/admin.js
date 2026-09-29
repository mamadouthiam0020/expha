'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const Registration = require('../models/Registration');
const hub = require('../lib/eventsHub');
const { getAdminData } = require('../lib/registrationsService');
const { signAdminToken, safeEqual, setAuthCookie, clearAuthCookie, requireAdmin, verifyToken } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Trop de tentatives. Reessayez dans quelques minutes.' },
});

/* POST /api/admin/login */
router.post('/login', loginLimiter, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !safeEqual(password, config.adminPassword)) {
    return res.status(401).json({ ok: false, message: 'Mot de passe incorrect.' });
  }
  const token = signAdminToken();
  setAuthCookie(res, token);
  return res.json({ ok: true, message: 'Connexion reussie.', data: { token } });
});

/* POST /api/admin/logout */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true, message: 'Deconnexion effectuee.' });
});

/* GET /api/admin/me */
router.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, data: { role: 'admin' } });
});

/**
 * GET /api/admin/stream  -  flux temps reel (Server-Sent Events)
 * Le token peut etre passe en query param (?token=) car EventSource
 * ne permet pas d'envoyer d'en-tetes.
 */
router.get('/stream', (req, res) => {
  if (!verifyToken(req)) return res.status(401).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const client = hub.addClient(res);
  hub.send(client, 'connected', { at: new Date().toISOString(), clients: hub.count() });

  // Premiere donnee immediate
  getAdminData()
    .then((data) => hub.send(client, 'dashboard', { query: '', data }))
    .catch(() => {});

  // Ping periodique : maintient la connexion ouverte derrière les proxys
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (err) {
      clearInterval(ping);
    }
  }, 25000);

  const close = () => {
    clearInterval(ping);
    hub.removeClient(client);
  };

  req.on('close', close);
  res.on('error', close);
  return undefined;
});

/* POST /api/admin/refresh  -  envoi manuel du rafraichissement aux autres clients */
router.post('/refresh', requireAdmin, async (req, res, next) => {
  try {
    const data = await getAdminData();
    hub.broadcast('dashboard', { query: '', data });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* GET /api/admin/count  -  compteur rapide (fallback si SSE indisponible) */
router.get('/count', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, data: { total: await Registration.countDocuments({}) } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
