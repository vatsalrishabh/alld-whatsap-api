const TrackedCase = require("../models/TrackedCase");

const addCaseAndMobile = async (req, res) => {
  try {
    let { caseNumbers, mobileNumber } = req.body;

    if (!Array.isArray(caseNumbers) || !mobileNumber) {
      return res.status(400).json({ message: "caseNumbers must be array and mobileNumber required" });
    }

    // Check if this mobile already exists
    let existingEntry = await TrackedCase.findOne({ mobileNumber });

    if (existingEntry) {
      // Merge new cases with existing ones (avoid duplicates)
      const updatedCases = Array.from(new Set([...existingEntry.caseNumbers, ...caseNumbers]));
      existingEntry.caseNumbers = updatedCases;
      await existingEntry.save();
      return res.json({ message: "Cases updated for existing mobile", data: existingEntry });
    }

    // Create new entry
    const newEntry = new TrackedCase({ caseNumbers, mobileNumber });
    await newEntry.save();

    res.json({ message: "New mobile & cases saved successfully", data: newEntry });

  } catch (error) {
    console.error("❌ Error saving cases:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { addCaseAndMobile };
