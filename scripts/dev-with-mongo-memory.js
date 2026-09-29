'use strict';

/**
 * Lance l'API avec une base MongoDB en memoire (aucune installation requise).
 * Utile pour tester en local quand MongoDB n'est pas installe.
 *
 *   npm run dev:local
 *
 * Les donnees sont perdues a l'arret du processus : pour un vrai test,
 * utilisez MongoDB local ou MongoDB Atlas (fichier .env).
 */
const path = require('path');

async function main() {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch (err) {
    console.error(
      '\n[mongo-memory] mongodb-memory-server est introuvable.\n' +
        '              Lancez : npm install --save-dev mongodb-memory-server\n'
    );
    process.exit(1);
  }

  const tmpDir = path.join(__dirname, '..', '.mongo-data');
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'expha', dbPath: tmpDir, storageEngine: 'wiredTiger' },
  });

  const uri = mongod.getUri('expha');
  process.env.MONGODB_URI = uri;
  console.log(`[mongo-memory] Base temporaire demarree : ${uri}`);

  const stop = async () => {
    await mongod.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  require('../server/index.js');
}

main().catch((err) => {
  console.error('[mongo-memory] Echec du demarrage :', err);
  process.exit(1);
});
