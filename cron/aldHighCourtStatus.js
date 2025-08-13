require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { startWhatsapp, getWhatsappClient } = require('./services/whatsappService');
const runHighCourtCheck = require('./cron/aldHighCourtStatus');

const app = express();

// Simple root route
app.get('/', (req, res) => {
    res.send('<h1>📢 WhatsApp High Court Status Bot is running!</h1>');
});

(async () => {
    console.log("🚀 Starting WhatsApp client...");
    await startWhatsapp();

    // Run every 30 minutes (adjust as needed)
    cron.schedule('*/30 * * * *', async () => {
        console.log("⏳ Running High Court status check...");
        await runHighCourtCheck();
    });

    // Start Express server
    app.listen(3000, () => {
        console.log('✅ Server running on http://localhost:3000');
    });
})();
