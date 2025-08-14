const express = require('express');
const cron = require('node-cron');
const connectDB = require('./config/db'); // Ensure this file exports a function to connect to MongoDB
const { getCaseDetailsByCino, notifyStatusToRecipients, checkNextHearingDateAndNotify, checkAllTrackedCasesAndNotifyFromDB } = require('./services/highCourtAlld');
const { startWhatsapp } = require('./services/whatsappService');
const { getLastQrCode } = require('./services/whatsappService');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();

// Middleware (optional)
app.use(express.json());

// Connect to MongoDB
connectDB();

// Start WhatsApp client for outbound notifications
startWhatsapp().catch((e) => console.error('❌ WhatsApp init failed:', e.message));

// Cron job - runs daily at 9AM
// cron.schedule('0 9 * * *', async () => {
//   try {
//     console.log('⏰ Running daily job at 9AM...');
//     const cino = process.env.DEFAULT_CINO || '1419388';
//     await getCaseDetailsByCino(cino);
//   } catch (error) {
//     console.error('❌ Error running cron job:', error);
//   }
// });

const CINO = process.env.DEFAULT_CINO || '1419388';
const NOTIFY_TO_LIST = process.env.NOTIFY_TO_LIST || '["8123573669","8423003490"]';

// On boot: send current status to recipients
(async () => {
  try {
    await notifyStatusToRecipients(CINO, NOTIFY_TO_LIST);
  } catch (e) {
    console.error('❌ Failed to send initial status:', e.message);
  }
})();

// Cron: check every 5 minutes for new hearing date and notify if changed (env default)
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running cron job every 5 minutes');
  try {
    await checkNextHearingDateAndNotify(CINO, NOTIFY_TO_LIST);
  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
});

// Cron: every 5 minutes, iterate over all tracked user cases and notify their owners on ANY change
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running tracked UserCase change check');
  try {
    await checkAllTrackedCasesAndNotifyFromDB();
  } catch (e) {
    console.error('❌ Tracked UserCase cron error:', e.message);
  }
});


// Root route - show WhatsApp QR if available
app.get('/', async (req, res) => {
  try {
    const qr = getLastQrCode();
    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html><head><title>WhatsApp QR</title><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0b1020;color:#fff"><div style="text-align:center"><h2 style="margin:0 0 12px">Scan to login WhatsApp</h2><img alt="QR" src="${dataUrl}" style="background:#fff;padding:8px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.3)"/><div style="opacity:.8;margin-top:10px">Open WhatsApp → Linked devices → Scan QR</div></div></body></html>`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><head><title>WhatsApp Status</title><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0b1020;color:#fff"><div style="text-align:center"><h2 style="margin:0 0 12px">✅ WhatsApp is authenticated</h2><div style="opacity:.8">No QR to show. Client is ready.</div></div></body></html>`);
  } catch (e) {
    res.status(500).send(`Failed to render QR: ${e.message}`);
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
