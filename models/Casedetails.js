const mongoose = require('mongoose');

const hearingDateSchema = new mongoose.Schema({
  cino: { type: String, required: true, unique: true },
  nextHearingDate: { type: String }, // Store as string or Date depending on format
});

module.exports = mongoose.model('HearingDate', hearingDateSchema);
