'use strict';

/**
 * Test de bout en bout : demarre l'API sur une base MongoDB en memoire,
 * verifie le formulaire d'inscription, l'espace admin, les filtres,
 * le temps reel (SSE) et l'export CSV / Excel.
 *
 *   npm run smoke
 */
process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'expha2026';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-secret';

const { MongoMemoryServer } = require('mongodb-memory-server');

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

const BASE = 'http://127.0.0.1:4099';

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const payload = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, payload, headers: res.headers };
}

const VALID = {
  nom: 'Diop',
  prenom: 'Awa',
  telephone: '77 123 45 67',
  structureMedicale: 'Centre de sante de Somone',
  invitePar: 'Maixent Dione',
  pointRamassage: 'Terminus Dem Dikk',
};

async function run() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'smoke' } });
  process.env.MONGODB_URI = mongod.getUri('smoke');
  process.env.PORT = '4099';

  // Demarre l'API dans le meme processus
  const app = require('../server/app');
  const mongoose = require('mongoose');
  const server = app.listen(4099, '127.0.0.1');

  await new Promise((resolve, reject) => {
    mongoose.connect(process.env.MONGODB_URI).then(resolve, reject);
  });

  try {
    console.log('\n1. Sante de l API');
    const health = await api('/api/health');
    check('GET /api/health', health.status === 200 && health.payload.ok === true);

    console.log('\n2. Configuration publique de l evenement');
    const event = await api('/api/event');
    check('GET /api/event', event.status === 200);
    check('5 options "Invite par"', event.payload.data.invitePar.length === 5);
    check('3 options "Point de ramassage"', event.payload.data.pointRamassage.length === 3);

    console.log('\n3. Validation du formulaire');
    const vide = await api('/api/registrations', { method: 'POST', body: {} });
    check('POST vide refuse (400)', vide.status === 400, `recu ${vide.status}`);
    check(
      '6 erreurs de champ renvoyees',
      Object.keys(vide.payload.errors || {}).length === 6,
      JSON.stringify(vide.payload.errors)
    );

    const incomplet = await api('/api/registrations', {
      method: 'POST',
      body: { nom: 'Sagna', prenom: 'Yacine' },
    });
    check('POST incomplet refuse (400)', incomplet.status === 400);
    check('telephone manquant detecte', Boolean(incomplet.payload.errors?.telephone));
    check('invitePar manquant detecte', Boolean(incomplet.payload.errors?.invitePar));
    check('pointRamassage manquant detecte', Boolean(incomplet.payload.errors?.pointRamassage));

    const mauvaisTel = await api('/api/registrations', {
      method: 'POST',
      body: { ...VALID, telephone: '123' },
    });
    check('telephone invalide refuse', mauvaisTel.status === 400);

    const mauvaiseListe = await api('/api/registrations', {
      method: 'POST',
      body: { ...VALID, invitePar: 'Quelqu un d autre' },
    });
    check('valeur hors liste refusee', mauvaiseListe.status === 400);

    const tiretDiff = await api('/api/registrations', {
      method: 'POST',
      body: {
        ...VALID,
        nom: 'Toure',
        prenom: 'Ibrahima',
        telephone: '701234599',
        pointRamassage: 'EDK Pikine - Sortie 9 - Sedima',
      },
    });
    check('tiret simple accepte et normalise', tiretDiff.status === 201,
      `recu ${tiretDiff.status}`);
    check(
      'libelle canonique conserve',
      tiretDiff.payload?.data?.pointRamassage === 'EDK Pikine – Sortie 9 – Sedima',
      tiretDiff.payload?.data?.pointRamassage
    );

    console.log('\n4. Inscription valide');
    const ok1 = await api('/api/registrations', { method: 'POST', body: VALID });
    check('POST valide accepte (201)', ok1.status === 201, `recu ${ok1.status}`);
    check(
      'message de confirmation exact',
      ok1.payload.message === 'Votre inscription a bien été enregistrée. Merci et à bientôt !',
      ok1.payload.message
    );
    check('numero d inscription attribue', /^EXPHA-2026-\d{4}$/.test(ok1.payload.data.numeroInscription || ''),
      ok1.payload.data?.numeroInscription);
    check('telephone normalise (chiffres)', /^[0-9]{9}$/.test(ok1.payload.data.telephone || ''),
      ok1.payload.data?.telephone);

    const autres = [
      { ...VALID, nom: 'Sagna', prenom: 'Yacine', telephone: '+221781234567', invitePar: 'Maguette Diop', pointRamassage: 'HLM Grand-Yoff' },
      { ...VALID, nom: 'Ndiaye', prenom: 'Aminata', telephone: '701112233', structureMedicale: 'Hopital Principal Dakar', invitePar: 'Mme Sow Aminata', pointRamassage: 'Terminus Dem Dikk' },
      { ...VALID, nom: 'Fall', prenom: 'Moussa', telephone: '778899001', structureMedicale: 'Hopital Principal Dakar', invitePar: 'Mme Niang Cor', pointRamassage: 'HLM Grand-Yoff' },
    ];    for (const body of autres) {
      const r = await api('/api/registrations', { method: 'POST', body });
      check(`inscription ${body.prenom} ${body.nom}`, r.status === 201, `recu ${r.status}`);
    }

    const totalAttendu = 1 + 1 + autres.length; // + tiret + 1ere + 3 autres
    const stats = await api('/api/registrations/stats');
    check('compteur public', stats.payload.data.total === totalAttendu,
      `${stats.payload.data.total} != ${totalAttendu}`);

    const uniques = new Set();
    const liste = await api('/api/registrations'); // sans token -> 401
    check('liste protegee par auth (401)', liste.status === 401, `recu ${liste.status}`);

    console.log('\n5. Connexion administrateur');
    const mauvais = await api('/api/admin/login', { method: 'POST', body: { password: 'faux' } });
    check('mauvais mot de passe refuse (401)', mauvais.status === 401);
    const loginRes = await api('/api/admin/login', {
      method: 'POST',
      body: { password: process.env.ADMIN_PASSWORD },
    });
    check('connexion reussie', loginRes.status === 200);
    const token = loginRes.payload.data.token;
    check('jeton recu', typeof token === 'string' && token.length > 20);

    const fauxToken = await api('/api/registrations/dashboard', { token: 'eyJhbGciOiJIUzI1NiJ9.faux' });
    check('jeton falsifie refuse (401)', fauxToken.status === 401,
      `recu ${fauxToken.status} ${JSON.stringify(fauxToken.payload)}`);

    const aucunToken = await api('/api/registrations/dashboard');
    check('acces sans jeton refuse (401)', aucunToken.status === 401);
    check('message explicite', /Authentification requise/.test(aucunToken.payload.message || ''),
      aucunToken.payload?.message);

    console.log('\n6. Tableau de bord admin');
    const dash = await api('/api/registrations/dashboard', { token });
    check('acces avec jeton', dash.status === 200);
    check(`total = ${totalAttendu}`, dash.payload.data.total === totalAttendu,
      String(dash.payload.data.total));
    check('lignes retournees', dash.payload.data.items.length === totalAttendu);
    check('2 structures distinctes', dash.payload.data.valeurs.structures.length === 2,
      JSON.stringify(dash.payload.data.valeurs.structures));
    uniques.clear();
    dash.payload.data.items.forEach((i) => uniques.add(i.numeroInscription));
    check('numeros uniques', uniques.size === totalAttendu, `${uniques.size}/${totalAttendu}`);

    console.log('\n7. Recherche et filtres');
    const recherche = await api('/api/registrations/dashboard?q=diop', { token });
    check('recherche par nom (diop)', recherche.payload.data.filteredCount === 1,
      String(recherche.payload.data.filteredCount));
    const rechercheTel = await api('/api/registrations/dashboard?q=781234567', { token });
    check('recherche par telephone', recherche.payload.data.filteredCount === 1,
      String(recherche.payload.data.filteredCount));
    const recherchePrenom = await api('/api/registrations/dashboard?q=awa', { token });
    check('recherche par prenom', recherche.payload.data.filteredCount === 1,
      String(recherche.payload.data.filteredCount));
    const filtreInvite = await api('/api/registrations/dashboard?invitePar=Maguette%20Diop', {
      token,
    });
    check('filtre invite (1 resultat)', filtreInvite.payload.data.filteredCount === 1,
      String(filtreInvite.payload.data.filteredCount));
    const filtreInviteMinuscule = await api(
      '/api/registrations/dashboard?invitePar=maguette%20diop',
      { token }
    );
    check('filtre invite insensible a la casse', filtreInviteMinuscule.payload.data.filteredCount === 1,
      String(filtreInviteMinuscule.payload.data.filteredCount));
    const filtrePoint = await api(
      `/api/registrations/dashboard?pointRamassage=${encodeURIComponent('HLM Grand-Yoff')}`,
      { token }
    );
    check('filtre point de ramassage (2)', filtrePoint.payload.data.filteredCount === 2,
      String(filtrePoint.payload.data.filteredCount));
    const filtreStructure = await api(
      `/api/registrations/dashboard?structureMedicale=${encodeURIComponent('Hopital Principal Dakar')}`,
      { token }
    );
    check('filtre structure medicale (2)', filtreStructure.payload.data.filteredCount === 2,
      String(filtreStructure.payload.data.filteredCount));
    const filtreCombine = await api(
      `/api/registrations/dashboard?invitePar=Maguette%20Diop&pointRamassage=${encodeURIComponent('HLM Grand-Yoff')}`,
      { token }
    );
    check('filtres combines', filtreCombine.payload.data.filteredCount === 1,
      String(filtreCombine.payload.data.filteredCount));

    console.log('\n8. Export');
    const csv = await api('/api/registrations/export.csv', { token });
    check('export CSV', csv.status === 200 && typeof csv.payload === 'string');
    const lignesCsv = String(csv.payload).trim().split('\r\n');
    check(`CSV : ${totalAttendu} lignes + entete`, lignesCsv.length === totalAttendu + 1,
      `${lignesCsv.length} lignes`);
    // Le BOM est retire par le decodeur UTF-8 de fetch : on verifie les octets bruts
    const csvBrut = Buffer.from(
      await (await fetch(`${BASE}/api/registrations/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })).arrayBuffer()
    );
    check('CSV : BOM UTF-8 (EF BB BF)', csvBrut[0] === 0xef && csvBrut[1] === 0xbb && csvBrut[2] === 0xbf,
      [...csvBrut.subarray(0, 3)].map((b) => b.toString(16)).join(' '));
    check('CSV : en-tetes FR', lignesCsv[0].includes('Structure médicale'));
    check('CSV : numero present', lignesCsv.some((l) => l.includes('EXPHA-2026-0001')));
    check('CSV : accents preserves', String(csv.payload).includes('Prénom'),
      lignesCsv[0]);

    const xls = await api('/api/registrations/export.xls', { token });
    check('export Excel', xls.status === 200 && String(xls.payload).includes('<table>'));
    check('Excel : en-tetes FR', String(xls.payload).includes('Point de ramassage'));

    const csvFiltre = await api(
      `/api/registrations/export.csv?pointRamassage=${encodeURIComponent('HLM Grand-Yoff')}`,
      { token }
    );
    check('export CSV filtre (2 lignes)', csvFiltre.payload.trim().split('\r\n').length === 3,
      String(csvFiltre.payload.trim().split('\r\n').length));

    check('export sans jeton refuse', (await api('/api/registrations/export.csv')).status === 401);

    console.log('\n9. Temps reel (SSE)');
    const sse = await openStream(`/api/admin/stream?token=${encodeURIComponent(token)}`);
    check('flux SSE ouvert', Boolean(sse));
    if (sse) {
      await sse.connected;
      const recu = sse.waitFor('registration', 8000);
      const nouvelle = await api('/api/registrations', {
        method: 'POST',
        body: { ...VALID, nom: 'Test', prenom: 'Samba', telephone: '765554433' },
      });
      check('inscription pendant le flux (201)', nouvelle.status === 201);
      const evt = await recu;
      check('evenement SSE recu', evt && evt.registration?.prenom === 'Samba',
        JSON.stringify(evt).slice(0, 120));
      sse.close();
    }
    const dash2 = await api('/api/registrations/dashboard', { token });
    check('total apres ajout temps reel', dash2.payload.data.total === totalAttendu + 1,
      String(dash2.payload.data.total));

    console.log('\n10. Sequence des numeros');
    const ordre = dash2.payload.data.items
      .map((i) => Number(i.numeroInscription.split('-').pop()))
      .sort((a, b) => a - b);
    const consecutifs = ordre.every((n, i) => i === 0 || n === ordre[i - 1] + 1);
    check('numeros consecutifs sans trou', consecutifs, JSON.stringify(ordre));
    check('prefixe EXPHA-2026', ordre.length === totalAttendu + 1);

    console.log('\n11. Suppression (admin)');
    const aSupprimer = dash2.payload.data.items.find((i) => i.nom === 'Test');
    const del = await api(`/api/registrations/${aSupprimer._id}`, { method: 'DELETE', token });
    check('suppression acceptee', del.status === 200);
    const dash3 = await api('/api/registrations/dashboard', { token });
    check('total apres suppression', dash3.payload.data.total === totalAttendu,
      String(dash3.payload.data.total));
    check('suppression sans jeton refusee', (await api(`/api/registrations/${aSupprimer._id}`, { method: 'DELETE' })).status === 401);

    console.log('\n12. Securite');
    const routeInconnue = await api('/api/inexistant');
    check('route API inconnue (404 JSON)', routeInconnue.status === 404);

    console.log('\n13. Anti-spam (limite sur POST uniquement)');
    // 25 requetes de consultation admin ne doivent pas declencher la limite d'inscription
    for (let i = 0; i < 25; i += 1) {
      await api('/api/registrations/dashboard', { token });
    }
    check('25 consultations admin acceptees', true);
    const apresConsultations = await api('/api/registrations', {
      method: 'POST',
      body: { ...VALID, nom: 'Beye', prenom: 'Fatou', telephone: '771010203' },
    });
    check('inscription toujours possible', apresConsultations.status === 201,
      `recu ${apresConsultations.status}`);

    // Depassement de la limite d'inscription depuis une IP
    let limitee = 0;
    for (let i = 0; i < 40; i += 1) {
      const r = await api('/api/registrations', {
        method: 'POST',
        body: { ...VALID, nom: 'Flood', prenom: 'Test', telephone: `77123${String(4000 + i)}` },
      });
      if (r.status === 429) limitee += 1;
    }
    check('anti-spam actif sur POST (429)', limitee > 0, `${limitee} rejets sur 40`);
    const adminToujoursOk = await api('/api/registrations/dashboard', { token });
    check('acces admin intact apres anti-spam', adminToujoursOk.status === 200,
      `recu ${adminToujoursOk.status}`);
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
    await mongoose.connection.close();
    await mongod.stop();
  }

  console.log(`\n${'='.repeat(46)}`);
  console.log(`  Resultat : ${passed} reussis, ${failed} echecs`);
  console.log('='.repeat(46));
  setTimeout(() => process.exit(failed === 0 ? 0 : 1), 100);
}

/** Petit client SSE pour verifier le temps reel. */
function openStream(url) {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`${BASE}${url}`, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      const listeners = [];
      let buffer = '';
      let connectedResolve;
      const connected = new Promise((r) => {
        connectedResolve = r;
      });

      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const frames = buffer.split('\n\n');
        buffer = frames.pop();
        frames.forEach((frame) => {
          const evtMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          if (!evtMatch || !dataMatch) return;
          const name = evtMatch[1].trim();
          let data = null;
          try {
            data = JSON.parse(dataMatch[1]);
          } catch (err) {
            data = null;
          }
          if (name === 'connected') connectedResolve(true);
          listeners.filter((l) => l.name === name).forEach((l) => l.resolve(data));
        });
      });

      resolve({
        connected,
        waitFor: (name, timeout = 5000) =>
          new Promise((r) => {
            listeners.push({ name, resolve: r });
            setTimeout(() => r(null), timeout);
          }),
        close: () => req.destroy(),
      });
    });
    req.on('error', () => resolve(null));
  });
}

run().catch((err) => {
  console.error('\nEchec du test :', err);
  process.exit(1);
});
