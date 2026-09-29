'use strict';

const Registration = require('../models/Registration');
const { INVITE_PAR_LEGACY, POINTS_RAMASSAGE_LEGACY, PRESENCE_DEFAUT } = require('../config/event');

/**
 * Migrations de donnees, jouees a chaque demarrage du serveur.
 * Idempotentes : sans effet si la base est deja a jour.
 */
async function runMigrations() {
  const legacyLists = [
    ['invitePar', INVITE_PAR_LEGACY],
    ['pointRamassage', POINTS_RAMASSAGE_LEGACY],
  ];

  for (const [field, legacy] of legacyLists) {
    for (const [ancien, nouveau] of legacy.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const res = await Registration.updateMany(
        { [field]: ancien },
        { $set: { [field]: nouveau } }
      );
      if (res.modifiedCount > 0) {
        console.log(
          `[migration] ${field} "${ancien}" -> "${nouveau}" (${res.modifiedCount})`
        );
      }
    }
  }

  const sansPresence = await Registration.updateMany(
    { presence: { $exists: false } },
    { $set: { presence: PRESENCE_DEFAUT } }
  );
  if (sansPresence.modifiedCount > 0) {
    console.log(
      `[migration] confirmation de presence manquante -> "${PRESENCE_DEFAUT}" (${sansPresence.modifiedCount})`
    );
  }
}

module.exports = { runMigrations };
