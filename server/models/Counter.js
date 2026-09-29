'use strict';

const mongoose = require('mongoose');

/**
 * Compteur atomique utilise pour generer un numero d'inscription unique
 * et non reutilisable (ex: EXPHA-2026-0007).
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Reserve atomique d'une sequence. La cle de lock est le nom du compteur.
 */
async function nextSequence(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc.seq;
}

module.exports = { Counter, nextSequence };
