'use strict';

require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expha',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  adminPassword: process.env.ADMIN_PASSWORD || 'expha2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 30,
};

if (config.isProd) {
  const missing = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (!process.env.JWT_SECRET || config.jwtSecret === 'dev-secret-change-me') {
    missing.push('JWT_SECRET (valeur par defaut)');
  }
  if (missing.length) {
    console.error(
      `[config] Variables manquantes ou invalides en production : ${missing.join(', ')}`
    );
    process.exit(1);
  }
}

module.exports = config;
