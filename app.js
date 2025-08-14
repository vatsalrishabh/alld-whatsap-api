const express = require('express');
const cron = require('node-cron');
const connectDB = require('./config/db'); // Ensure this file exports a function to connect to MongoDB
const { getCaseDetailsByCino, notifyStatusToRecipients, checkNextHearingDateAndNotify } = require('./services/highCourtAlld');
const { startWhatsapp } = require('./services/whatsappService');
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

// Cron: check every 5 minutes for new hearing date and notify if changed
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running cron job every 5 minutes');
  try {
    await checkNextHearingDateAndNotify(CINO, NOTIFY_TO_LIST);
  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
});


// Root route
app.get('/', (req, res) => {
  res.send('✅ Server & MongoDB connected. Cron job set.');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
