'use strict';

/**
 * Verifie que le build du frontend est bien servi par Express
 * (accueil, /admin, routes inconnues, fichiers statiques).
 *
 *   npm run verify:static
 */
const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, '..', 'client', 'dist');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('client/dist absent. Lancez : npm run build');
  process.exit(1);
}

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const app = require('../server/app');

const PORT = 4098;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  OK   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

const server = app.listen(PORT, '127.0.0.1', async () => {
  try {
    const html = await (await fetch(`${BASE}/`)).text();
    check('GET / renvoie le frontend', html.includes('<div id="root">'));
    check('titre present', /Journée de formation et de détente/i.test(html));

    const admin = await fetch(`${BASE}/admin`);
    const adminHtml = await admin.text();
    check('GET /admin renvoie index.html (SPA)', adminHtml.includes('<div id="root">'));
    check('/admin renvoie 200', admin.status === 200);

    const inconnu = await fetch(`${BASE}/page-inexistante`);
    check('route inconnue -> index.html', (await inconnu.text()).includes('<div id="root">'));

    const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1]);
    check('assets references', assets.length >= 2, JSON.stringify(assets));
    for (const asset of assets) {
      const r = await fetch(`${BASE}/${asset}`);
      check(`asset servi : ${asset}`, r.status === 200, `recu ${r.status}`);
    }

    const api404 = await fetch(`${BASE}/api/nimporte-quoi`);
    check('API inconnue -> 404 JSON', api404.status === 404);

    const health = await fetch(`${BASE}/api/health`);
    check('GET /api/health', health.status === 200);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL exception : ${err.message}`);
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
    console.log(`\n  ${passed} reussis, ${failed} echecs\n`);
    setTimeout(() => process.exit(failed === 0 ? 0 : 1), 100);
  }
});
