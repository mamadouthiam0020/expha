'use strict';

const mongoose = require('mongoose');

const { INVITE_PAR, POINTS_RAMASSAGE, PRESENCE_CHOICES, PRESENCE_DEFAUT } = require('../config/event');

/**
 * Un enregistrement = une inscription d'un participant.
 */
const registrationSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      trim: true,
      maxlength: 80,
    },
    prenom: {
      type: String,
      required: [true, 'Le prenom est obligatoire'],
      trim: true,
      maxlength: 80,
    },
    telephone: {
      type: String,
      required: [true, 'Le numero de telephone est obligatoire'],
      trim: true,
      maxlength: 30,
    },
    structureMedicale: {
      type: String,
      required: [true, 'La structure medicale est obligatoire'],
      trim: true,
      maxlength: 160,
    },
    invitePar: {
      type: String,
      required: [true, 'Le champ "Invite par" est obligatoire'],
      trim: true,
      enum: {
        values: INVITE_PAR,
        message: 'Valeur de "Invite par" non autorisee',
      },
    },
    pointRamassage: {
      type: String,
      required: [true, 'Le point de ramassage est obligatoire'],
      trim: true,
      enum: {
        values: POINTS_RAMASSAGE,
        message: 'Valeur de "Point de ramassage" non autorisee',
      },
    },
    presence: {
      type: String,
      required: [true, 'La confirmation de presence est obligatoire'],
      trim: true,
      default: PRESENCE_DEFAUT,
      enum: {
        values: PRESENCE_CHOICES,
        message: 'Valeur de "Confirmation de presence" non autorisee',
      },
    },
    numeroInscription: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ nom: 1, prenom: 1 });
registrationSchema.index({ invitePar: 1 });
registrationSchema.index({ pointRamassage: 1 });
registrationSchema.index({ presence: 1 });
registrationSchema.index({ structureMedicale: 1 });

registrationSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Registration', registrationSchema);
