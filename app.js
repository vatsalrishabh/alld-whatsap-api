const express = require('express');
const path = require('path');
const cron = require('node-cron');
const connectDB = require('./config/db');
const {
  getCaseDetailsByCino,
  notifyStatusToRecipients,
  checkNextHearingDateAndNotify,
  checkAllTrackedCasesAndNotifyFromDB
} = require('./services/highCourtAlld');
const caseRoutes = require("./routes/addToDbRoutes"); // ✅ your routes
const dcaseRoutes = require("./routes/addToDbRoutes")
require('dotenv').config();

const app = express();

// ===== Middleware =====
app.use(express.json());

// ===== Connect to MongoDB =====
connectDB();

// ====== Serve static frontend files from public/ ======
app.use(express.static(path.join(__dirname, 'public')));

// ====== API Routes ======
app.use("/api/cases", caseRoutes);
app.use("/api/dcases", dcaseRoutes);

// ====== Default Root Route ======
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== CRON JOBS ======
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

// Every 5 minutes check hearing date
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running cron job every 5 minutes');
  try {
    await checkNextHearingDateAndNotify(CINO, NOTIFY_TO_LIST);
  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
});

// Every 5 minutes check all tracked cases
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running tracked UserCase change check');
  try {
    await checkAllTrackedCasesAndNotifyFromDB();
  } catch (e) {
    console.error('❌ Tracked UserCase cron error:', e.message);
  }
});

// ====== START SERVER ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
