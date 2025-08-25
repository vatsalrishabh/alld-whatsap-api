//models/TrackedCase.js
const mongoose = require("mongoose");

const TrackedCaseSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, unique: true }, // one unique mobile
  caseNumbers: { type: [String], required: true },              // multiple cases
  createdAt: { type: Date, default: Date.now }
});

const TrackedCase = mongoose.model("TrackedCase", TrackedCaseSchema);

module.exports = TrackedCase;
