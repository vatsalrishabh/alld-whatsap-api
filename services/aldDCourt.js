//services/aldDCourt.js

const axios = require("axios");
const qs = require("qs");
const cheerio = require("cheerio");
const Case = require("../models/Case");

async function fetchCase(cino) {
  const url = "https://prayagraj.dcourts.gov.in/wp-admin/admin-ajax.php";
  const res = await axios.post(url, qs.stringify({
    cino,
    action: "get_cnr_details",
    es_ajax_request: "1"
  }), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const $ = cheerio.load(res.data.data);

  // --- Case Details ---
  let caseDetails = {};
  $("caption:contains('Case Details')").next("thead").next("tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    caseDetails = {
      caseType: $(tds[0]).text().trim(),
      filingNumber: $(tds[1]).text().trim(),
      filingDate: $(tds[2]).text().trim(),
      regNumber: $(tds[3]).text().trim(),
      regDate: $(tds[4]).text().trim(),
      cnr: $(tds[5]).text().trim()
    };
  });

  // --- Case Status ---
  let status = {};
  $("caption:contains('Case Status')").next("thead").next("tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    status = {
      firstHearing: $(tds[0]).text().trim(),
      nextHearing: $(tds[1]).text().trim(),
      caseStatus: $(tds[2]).text().trim(),
      stage: $(tds[3]).text().trim(),
      judge: $(tds[4]).text().trim()
    };
  });

  // Save or Update in MongoDB
  await Case.findOneAndUpdate(
    { cnr: caseDetails.cnr },
    { ...caseDetails, status },
    { upsert: true, new: true }
  );

  return { caseDetails, status };
}

module.exports = {
    fetchCase
}