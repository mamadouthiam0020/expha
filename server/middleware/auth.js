'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE_NAME = 'expha_admin';

function signAdminToken() {
  return jwt.sign({ role: 'admin', scope: 'registrations' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  // EventSource / liens de telechargement ne permettent pas les en-tetes
  if (req.query && typeof req.query.token === 'string' && req.query.token) {
    return req.query.token;
  }
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (match) return decodeURIComponent(match.split('=').slice(1).join('='));
  }
  return null;
}

/** Verifie le token (cookie, Bearer ou query) et retourne le payload ou null. */
function verifyToken(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return payload.role === 'admin' ? payload : null;
  } catch (err) {
    return null;
  }
}

/** Middleware : refuse la requete si l'admin n'est pas authentifie. */
function requireAdmin(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    return res.status(401).json({
      ok: false,
      message: readToken(req) ? 'Session expiree, reconnectez-vous.' : 'Authentification requise.',
    });
  }
  req.admin = payload;
  return next();
}

/** Comparaison a temps constant pour le mot de passe. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i += 1) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  requireAdmin,
  verifyToken,
  signAdminToken,
  safeEqual,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
};
