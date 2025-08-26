require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");

// Import WhatsApp sender (your own service)
const { sendMessage } = require("./services/whatsappService");

// 🗂️ Cache to avoid duplicate alerts
const sentCache = {};
// 🕒 Hearing cache to calculate duration
const hearingCache = {};

// Helper: get today's date (YYYY-MM-DD)
function getToday() {
  return new Date().toISOString().split("T")[0];
}

async function checkCourtView() {
  try {
    console.log("🔍 Checking court view...");

    const url = "https://courtview.allahabadhighcourt.in/courtview/CourtViewAllahabad.do";
    const { data: html } = await axios.get(url, { timeout: 20000 });
    const $ = cheerio.load(html);

    $("table tr").each(async (i, row) => {
      const tds = $(row).find("td");
      if (tds.length < 5) return;

      const courtNo = $(tds[0]).text().trim();
      if (courtNo !== "43") return; // 🚨 Only Court No. 43

      const serialNo = $(tds[1]).text().trim();
      const listType = $(tds[2]).text().trim();
      const progress = $(tds[3]).text().trim();
      const caseDetailsText = $(tds[4]).text().replace(/\s+/g, " ").trim();
      const importantInfo = $(tds[5]).text().trim();

      const today = getToday();
      const caseId = `${courtNo}-${serialNo}-${caseDetailsText.split(" ")[0]}`;
      const cacheKey = `${caseId}-${today}-${progress}-${importantInfo}`;

      // 🚫 Avoid duplicates
      if (sentCache[cacheKey]) return;

      // 🔎 Combine progress + info to detect hearing state
      const statusText = `${progress} ${importantInfo}`.toLowerCase();

      // 🕒 Track hearing duration
      const hearingKey = `${caseId}-${today}`;
      let durationText = "";
      if (statusText.includes("heard")) {
        if (!hearingCache[hearingKey]) {
          hearingCache[hearingKey] = { startTime: Date.now(), lastStatus: statusText };
        }
      } else if (
        hearingCache[hearingKey] &&
        hearingCache[hearingKey].lastStatus.includes("heard")
      ) {
        const durationMs = Date.now() - hearingCache[hearingKey].startTime;
        const mins = Math.floor(durationMs / 60000);
        const secs = Math.floor((durationMs % 60000) / 1000);
        durationText = `\n🕒 Heard for ${mins}m ${secs}s`;
        delete hearingCache[hearingKey];
      }

      // 📨 Message structure
      const message = 
`📌 Court No: ${courtNo}
#️⃣ Serial No: ${serialNo}
📋 List: ${listType}
➡️ Progress: ${progress || "N/A"}
📑 Case Details: ${caseDetailsText}
ℹ️ Info: ${importantInfo}${durationText}`;

      try {
        await sendMessage([918123573669, 916393657824], message);
        console.log("📤 Alert sent for Court 43:", caseDetailsText);
        sentCache[cacheKey] = true;
      } catch (err) {
        console.error("❌ Failed to send WhatsApp:", err.message);
      }
    });

    console.log("✅ Check complete.");
  } catch (err) {
    console.error("❌ Error in court view check:", err.message);
  }
}

// Run immediately
checkCourtView();

// Schedule every 30 sec
cron.schedule("*/30 * * * * *", checkCourtView);
