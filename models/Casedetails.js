const mongoose = require('mongoose');

const caseDetailsSchema = new mongoose.Schema(
  {
    cino: { type: String, required: true, unique: true },
    status: { type: String },
    stage: { type: String },
    bench: { type: String },
    nextHearingDate: { type: String },
    petitioner: { type: String },
    respondent: { type: String },
    lastSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CaseDetails', caseDetailsSchema);
