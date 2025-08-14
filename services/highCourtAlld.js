// services/highcourtService.js
const axios = require('axios');
const cheerio = require('cheerio');
const CaseDetails = require('../models/Casedetails');
const { startWhatsapp, sendMessage } = require('./whatsappService');

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
          Referer: 'https://allahabadhighcourt.in/apps/status_ccms/',
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
 * Extract and persist ALL case details by CINO
 * - Saves all fields to DB
 * - Detects changes across ALL fields
 * - Returns { result, changedFields, before }
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
          Referer: 'https://allahabadhighcourt.in/',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    const $ = cheerio.load(response.data);

    // Build the full result object from the HTML structure you provided
    const result = {
      cino,
      generatedOn: $('span:contains("Generated on")').text().trim().replace('Generated on :', '').trim(),
      filingNo: $('th:contains("Filing No.")').next().text().trim(),
      filingDate: $('th:contains("Filing Date")').next().text().trim(),
      cnr: $('th:contains("CNR")').next().text().trim(),
      registrationDate: $('td:contains("Date of Registration")').text().replace('Date of Registration :', '').trim(),
      status: $('h3.text-center.text-danger.blinkingD').text().trim(), // e.g., DISPOSED
      firstHearingDate: $('th:contains("First Hearing Date")').next().text().trim(),
      nextHearingDate: $('th:contains("Next Hearing Date")').next().text().trim(),
      coram: $('th:contains("Coram")').next().text().trim(),
      bench: $('th:contains("Bench Type")').next().text().trim(),
      state: $('th:contains("State")').next().text().trim(),
      // The Petitioner/Respondent table is wrapped in a div after the H3
      petitioner: $('h3:contains("Petitioner/Respondent")')
        .next('div')
        .find('table tbody tr td')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' '),
      respondent: $('h3:contains("Petitioner/Respondent")')
        .next('div')
        .find('table tbody tr td')
        .last()
        .text()
        .trim()
        .replace(/\s+/g, ' '),
      category: $('th:contains("Category")').next().text().trim(),
      subCategory: $('th:contains("Sub Category")').next().text().trim(),
    };

    console.log('📄 Extracted Case Info:', result);

    // Fields to monitor for changes (all keys of result)
    const fieldsToCheck = Object.keys(result);

    // Load previous snapshot
    const existing = await CaseDetails.findOne({ cino });

    let changedFields = [];
    let before = {};

    if (existing) {
      for (const field of fieldsToCheck) {
        const prev = ((existing[field] ?? '') + '').trim();
        const curr = ((result[field] ?? '') + '').trim();
        if (prev !== curr) {
          changedFields.push(field);
          before[field] = prev;
        }
      }

      // Persist latest snapshot
      Object.assign(existing, result, { lastSnapshot: result });
      await existing.save();
    } else {
      // First time: save all; treat non-empty fields as changes
      changedFields = fieldsToCheck.filter((f) => (result[f] || '').toString().trim() !== '');
      await CaseDetails.create({ ...result, lastSnapshot: result });
    }

    return { result, changedFields, before };
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
    cy: '2025',
  };

  try {
    const response = await axios.post(
      'https://allahabadhighcourt.in/apps/status_ccms/index.php/get-order-sheets',
      new URLSearchParams(payload).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const html = response.data;
    const regex =
      /href='(https:\/\/elegalix\.allahabadhighcourt\.in\/elegalix\/WebDownloadJudgmentDocument\.do\?judgmentID=\d+)'/;
    const match = html.match(regex);

    if (match && match[1]) {
      const currentLink = match[1];
      if (currentLink !== lastJudgmentLink) {
        console.log('🔔 New Order Link Found:', currentLink);
        lastJudgmentLink = currentLink;

        const to = process.env.NOTIFY_TO || '918123573669@c.us';
        try {
          await startWhatsapp();
          await sendMessage(to, `Allahabad HC: New order/judgment detected\nLink: ${currentLink}`);
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

/** Helpers: recipients + messaging */
function parseRecipients(input) {
  try {
    if (!input) throw new Error('No input');
    let arr = [];
    if (input.trim().startsWith('[')) {
      arr = JSON.parse(input);
    } else {
      arr = input.split(',');
    }
    return arr
      .map((x) => String(x).replace(/\D/g, ''))
      .filter(Boolean)
      .map((digits) => (digits.includes('@') ? digits : `91${digits}@c.us`));
  } catch (_) {
    // Fallback list
    return ['918123573669@c.us', '918423003490@c.us'];
  }
}

async function sendToRecipients(recipients, message) {
  try {
    await startWhatsapp();
  } catch (_) {}
  for (const to of recipients) {
    try {
      await sendMessage(to, message);
      console.log(`📲 Notified ${to}`);
    } catch (e) {
      console.error('❌ Failed to send WhatsApp notification:', to, e.message);
    }
  }
}

/** Formats a compact status message (handy for manual pings) */
function formatStatusMessage(cino, info) {
  return [
    `Allahabad HC status for CINO ${cino}`,
    `Status: ${info.status || '—'}`,
    `First Hearing: ${info.firstHearingDate || '—'}`,
    `Next Hearing: ${info.nextHearingDate || '—'}`,
    `Coram: ${info.coram || '—'}`,
    `Bench: ${info.bench || '—'}`,
    `State: ${info.state || '—'}`,
    `Petitioner: ${info.petitioner || '—'}`,
    `Respondent: ${info.respondent || '—'}`,
    `Category: ${info.category || '—'}`,
    `SubCategory: ${info.subCategory || '—'}`,
    `Filing No: ${info.filingNo || '—'}`,
    `Filing Date: ${info.filingDate || '—'}`,
    `CNR: ${info.cnr || '—'}`,
    `Reg. Date: ${info.registrationDate || '—'}`,
    `Generated On: ${info.generatedOn || '—'}`,
  ].join('\n');
}

/** Pretty labels for change notifications */
function prettyLabel(field) {
  switch (field) {
    case 'generatedOn':
      return 'Generated On';
    case 'filingNo':
      return 'Filing No.';
    case 'filingDate':
      return 'Filing Date';
    case 'cnr':
      return 'CNR';
    case 'registrationDate':
      return 'Date of Registration';
    case 'status':
      return 'Status';
    case 'firstHearingDate':
      return 'First Hearing Date';
    case 'nextHearingDate':
      return 'Next Hearing Date';
    case 'coram':
      return 'Coram';
    case 'bench':
      return 'Bench Type';
    case 'state':
      return 'State';
    case 'petitioner':
      return 'Petitioner';
    case 'respondent':
      return 'Respondent';
    case 'category':
      return 'Category';
    case 'subCategory':
      return 'Sub Category';
    default:
      return field;
  }
}

/** Compose a multi-line change summary message */
function formatChangeMessage(cino, changedFields, before, after) {
  const title = `Allahabad HC update for CINO ${cino}`;
  const lines = changedFields.map((f) => {
    const prev = (before[f] ?? '—').toString();
    const curr = (after[f] ?? '—').toString();
    return `${prettyLabel(f)}: ${prev} → ${curr}`;
  });
  return `${title}\n${lines.join('\n')}`;
}

/**
 * Notify: send current status (no change check)
 */
async function notifyStatusToRecipients(cino, recipientsInput) {
  const recipients = parseRecipients(recipientsInput || process.env.NOTIFY_TO_LIST);
  const data = await getCaseDetailsByCino(cino);
  if (!data) return null;
  const { result } = data;
  const message = formatStatusMessage(cino, result);
  await sendToRecipients(recipients, message);
  return result;
}

/**
 * Notify if next hearing date changed (legacy)
 */
async function checkNextHearingDateAndNotify(cino, recipientsInput) {
  const recipients = parseRecipients(recipientsInput || process.env.NOTIFY_TO_LIST);
  const data = await getCaseDetailsByCino(cino);
  if (!data) return null;

  const { result, changedFields, before } = data;
  if (changedFields.includes('nextHearingDate')) {
    const prev = (before.nextHearingDate || '—').toString();
    const curr = (result.nextHearingDate || '—').toString();
    const msg = `Allahabad HC: New hearing date for CINO ${cino}\n${prev} → ${curr}`;
    await sendToRecipients(recipients, msg);
  } else {
    console.log('⏳ No new hearing date.');
  }
  return { result, changedFields };
}

/**
 * Notify if ANY field changed (recommended)
 */
async function checkCaseChangesAndNotify(cino, recipientsInput) {
  const recipients = parseRecipients(recipientsInput || process.env.NOTIFY_TO_LIST);
  const data = await getCaseDetailsByCino(cino);
  if (!data) return null;

  const { result, changedFields, before } = data;

  if (changedFields.length > 0) {
    const msg = formatChangeMessage(cino, changedFields, before, result);
    await sendToRecipients(recipients, msg);
  } else {
    console.log('⏳ No changes detected.');
  }

  return { result, changedFields };
}

module.exports = {
  callHighCourt,
  getCaseDetailsByCino,
  checkOrderSheets,
  notifyStatusToRecipients,
  checkNextHearingDateAndNotify,
  checkCaseChangesAndNotify,
};
