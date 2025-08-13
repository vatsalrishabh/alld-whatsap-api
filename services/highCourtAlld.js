const axios = require('axios');
const cheerio = require('cheerio');

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

    // Dummy storage logic
    const previousDate = await getStoredNextDate(cino); // Replace with actual logic
    if (nextHearingDate && nextHearingDate !== previousDate) {
      console.log(`🆕 New hearing date: ${nextHearingDate}`);
      await whatsappMessageNotification(result); // Replace with real function
      await storeNextDate(cino, nextHearingDate); // Replace with real DB store
    } else {
      console.log('⏳ Hearing date unchanged.');
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

        // You can send notification or store it in DB here
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

// Dummy placeholders – replace these with real logic or DB functions
const getStoredNextDate = async (cino) => {
  return null; // simulate first-time
};
const storeNextDate = async (cino, date) => {
  console.log(`📦 Stored new date (${date}) for CINO ${cino}`);
};
const whatsappMessageNotification = async (result) => {
  console.log(`📲 Sending WhatsApp message for CINO ${result.cino}`);
};

module.exports = {
  callHighCourt,
  getCaseDetailsByCino,
  checkOrderSheets
};
