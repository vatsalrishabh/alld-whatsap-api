const mongoose = require('mongoose');

const caseDetailsSchema = new mongoose.Schema(
  {
    cino: { type: String, required: true, unique: true },
    // Common fields
    status: { type: String },
    stage: { type: String },
    bench: { type: String },
    nextHearingDate: { type: String },
    petitioner: { type: String },
    respondent: { type: String },

    // Extended fields extracted in service
    generatedOn: { type: String },
    filingNo: { type: String },
    filingDate: { type: String },
    cnr: { type: String },
    registrationDate: { type: String },
    firstHearingDate: { type: String },
    coram: { type: String },
    state: { type: String },
    category: { type: String },
    subCategory: { type: String },

    // Keep full snapshot for diffing/future fields
    lastSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model('CaseDetails', caseDetailsSchema);
