const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  cnr: { type: String, required: true, unique: true },

  caseType: String,
  filingNumber: String,
  filingDate: String,   // keep String if not always a valid Date
  regNumber: String,
  regDate: String,

  // status subdocument
  status: {
    firstHearing: String,
    nextHearing: String,
    caseStatus: String,
    stage: String,
    judge: String
  }
}, { timestamps: true }); // adds createdAt + updatedAt

module.exports = mongoose.model("Case", caseSchema);
