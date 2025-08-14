const mongoose = require('mongoose');

const userCaseSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true }, // normalized WhatsApp JID e.g., 918123456789@c.us
    cino: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userCaseSchema.index({ phoneNumber: 1, cino: 1 }, { unique: true });

module.exports = mongoose.model('UserCase', userCaseSchema);


