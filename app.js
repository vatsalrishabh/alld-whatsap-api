const express = require('express');
const cron = require('node-cron');
const connectDB = require('./config/db'); // Ensure this file exports a function to connect to MongoDB
const { getCaseDetailsByCino } = require('./services/highCourtAlld');
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

cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running cron job every 5 minutes');
  try {
    await getCaseDetailsByCino('1419388');
  } catch (err) {
    console.error('❌ Failed to fetch case details:', err.message);
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
