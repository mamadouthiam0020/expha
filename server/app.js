'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { EVENT, INVITE_PAR, POINTS_RAMASSAGE } = require('./config/event');
const registrationsRouter = require('./routes/registrations');
const adminRouter = require('./routes/admin');
const { verifyToken } = require('./middleware/auth');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // gere par le serveur statique / pas de CDN requis
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

/* Limite globale douce sur l'API */
app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/*
 * Limite dediee a l'espace admin : tres large et ignoree pour les requetes
 * correctement authentifiees, afin que la consultation du tableau de bord
 * ne soit jamais bloquee.
 */
app.use(
  '/api/admin',
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => Boolean(verifyToken(req)),
  })
);

// Les routes d'inscription applique leur propre limite sur POST uniquement
// (voir server/routes/registrations.js) : la consultation admin n'est pas concernee.
app.use('/api/registrations', registrationsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'up', env: config.nodeEnv, time: new Date().toISOString() });
});

app.get('/api/event', (req, res) => {
  res.json({ ok: true, data: { event: EVENT, invitePar: INVITE_PAR, pointRamassage: POINTS_RAMASSAGE } });
});

// 404 API
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: 'Route API introuvable.' });
});

/* ------------------------------------------------------------------ */
/*  Frontend compile (client/dist)                                     */
/* ------------------------------------------------------------------ */
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

if (fs.existsSync(CLIENT_DIST)) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      maxAge: config.isProd ? '7d' : 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );

  // SPA fallback : /admin et toute autre route -> index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res
      .status(200)
      .type('html')
      .send(
        `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>EXPHA</title>
        <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6;color:#0f172a}
        code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>
        <body><h1>Journée de formation et de détente</h1>
        <p>Le frontend n'est pas encore compilé.</p>
        <p>En développement : lancez <code>npm run dev</code> puis ouvrez <code>http://localhost:5173</code>.</p>
        <p>En production : lancez <code>npm run build</code> (compile <code>client/dist</code>) puis <code>npm start</code>.</p>
        </body></html>`
      );
  });
}

/* Gestion centralisee des erreurs */
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      message: 'Certains champs sont invalides ou manquants.',
      errors: Object.fromEntries(Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])),
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ ok: false, message: 'Cette inscription existe deja.' });
  }
  console.error('[erreur]', err);
  return res.status(500).json({
    ok: false,
    message: 'Une erreur interne est survenue. Merci de reessayer.',
  });
});

module.exports = app;
