'use strict';

const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

async function connectMongo() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  console.log(`[mongo] connecte a ${redact(config.mongodbUri)}`);
  return mongoose.connection;
}

function redact(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

async function start() {
  try {
    await connectMongo();
  } catch (err) {
    console.error('[mongo] echec de connexion :', err.message);
    console.error('[mongo] Verifiez MONGODB_URI dans le fichier .env');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] EXPHA demarre sur le port ${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} recu, arret...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
