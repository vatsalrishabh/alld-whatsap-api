const axios = require('axios');
const cheerio = require('cheerio');
const CaseDetails = require('../models/Casedetails');
const { startWhatsapp } = require('./whatsappService');
const { sendMessage } = require('./whatsappService');

let lastJudgmentLink = ''; // Keep track of last seen order link

/**
 * Call Allahabad High Court FIR status API
 */
async function callHighCourt() {
  const payload = {
    crst_type: '',
    crno: '',
    crime_type: '3',
    crst_no: '229',
    year: '2025',
    district: '70',
    police_station: '31623022',
    captchacode: '5572', // Usually dynamic
  };

  try {
    const response = await axios.post(
      'https://allahabadhighcourt.in/apps/status_ccms/index.php/get_CaseInfo_fir',
      new URLSearchParams(payload),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://allahabadhighcourt.in/apps/status_ccms/',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    console.log('✅ FIR Status Response:', response.data);
  } catch (error) {
    console.error('❌ Error calling High Court API (FIR):', error.message);
  }
}

/**
 * Get case details by CINO and parse important info
 */
const getCaseDetailsByCino = async (cino) => {
  const payload = new URLSearchParams({ cino });

  try {
    const response = await axios.post(
      'https://allahabadhighcourt.in/apps/status_ccms/index.php/get_CaseDetails',
      payload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://allahabadhighcourt.in/',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    const $ = cheerio.load(response.data);

    const caseStatus = $('h3:contains("Case Status")').next('table').text();
    const stage = $('th:contains("Stage of Case")').next().text().trim();
    const bench = $('th:contains("Bench Type")').next().text().trim();
    const nextHearingDate = $('th:contains("Next Hearing Date")').next().text().trim();
    const petitioner = $('h3:contains("Petitioner/Respondent")').next('table')
      .find('td').first().text().trim().replace(/\s+/g, ' ');
    const respondent = $('h3:contains("Petitioner/Respondent")').next('table')
      .find('td').last().text().trim().replace(/\s+/g, ' ');

    const result = {
      cino,
      status: caseStatus || 'Unknown',
      stage,
      bench,
      nextHearingDate,
      petitioner,
      respondent,
    };

    console.log('📄 Extracted Case Info:', result);

    // Ensure WhatsApp is started (safe to call repeatedly)
    try { await startWhatsapp(); } catch (_) {}

    // Load previous snapshot
    const existing = await CaseDetails.findOne({ cino });

    const fieldsToCheck = ['status', 'stage', 'bench', 'nextHearingDate', 'petitioner', 'respondent'];
    let changedFields = [];
    let before = {};

    if (existing) {
      for (const field of fieldsToCheck) {
        const prev = (existing[field] || '').trim();
        const curr = (result[field] || '').trim();
        if (prev !== curr) {
          changedFields.push(field);
          before[field] = prev;
        }
      }
    } else {
      // First time tracking; treat all as changes
      changedFields = fieldsToCheck.filter((f) => (result[f] || '').trim() !== '');
    }

    // Persist latest snapshot
    if (existing) {
      for (const field of fieldsToCheck) existing[field] = result[field] || '';
      existing.lastSnapshot = result;
      await existing.save();
    } else {
      await CaseDetails.create({
        cino,
        ...result,
        lastSnapshot: result,
      });
    }

    // Notify if anything changed
    if (changedFields.length > 0) {
      const message = formatChangeMessage(cino, changedFields, before, result);
      const to = process.env.NOTIFY_TO || '918123573669@c.us';
      try {
        await sendMessage(to, message);
        console.log(`📲 Notified ${to}`);
      } catch (notifyErr) {
        console.error('❌ Failed to send WhatsApp notification:', notifyErr.message);
      }
    } else {
      console.log('⏳ No changes detected.');
    }

    return result;

  } catch (err) {
    console.error('❌ Failed to fetch case details:', err.message);
    return null;
  }
};

/**
 * Check for new order/judgement in case orders
 */
const checkOrderSheets = async () => {
  const payload = {
    ct: 'BAIL',
    cn: '18371',
    cy: '2025'
  };

  try {
    const response = await axios.post(
      'https://allahabadhighcourt.in/apps/status_ccms/index.php/get-order-sheets',
      new URLSearchParams(payload).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const html = response.data;
    const regex = /href='(https:\/\/elegalix\.allahabadhighcourt\.in\/elegalix\/WebDownloadJudgmentDocument\.do\?judgmentID=\d+)'/;
    const match = html.match(regex);

    if (match && match[1]) {
      const currentLink = match[1];
      if (currentLink !== lastJudgmentLink) {
        console.log('🔔 New Order Link Found:', currentLink);
        lastJudgmentLink = currentLink;

        // Notify about new order link
        const to = process.env.NOTIFY_TO || '918123573669@c.us';
        try {
          await startWhatsapp();
          await sendMessage(
            to,
            `Allahabad HC: New order/judgment detected\nLink: ${currentLink}`
          );
        } catch (e) {
          console.error('❌ Failed to notify about new order link:', e.message);
        }
      } else {
        console.log('✅ No new judgment yet...');
      }
    } else {
      console.log('⚠️ No judgment link found.');
    }

  } catch (err) {
    console.error('❌ Error fetching order sheet:', err.message);
  }
};

function formatChangeMessage(cino, changedFields, before, after) {
  const title = `Allahabad HC update for CINO ${cino}`;
  const lines = changedFields.map((f) => {
    const prev = (before[f] || '—').toString();
    const curr = (after[f] || '—').toString();
    return `${prettyLabel(f)}: ${prev} → ${curr}`;
  });
  return `${title}\n${lines.join('\n')}`;
}

function prettyLabel(field) {
  switch (field) {
    case 'nextHearingDate': return 'Next Hearing Date';
    case 'status': return 'Status';
    case 'stage': return 'Stage';
    case 'bench': return 'Bench';
    case 'petitioner': return 'Petitioner';
    case 'respondent': return 'Respondent';
    default: return field;
  }
}

module.exports = {
  callHighCourt,
  getCaseDetailsByCino,
  checkOrderSheets
};
