const axios = require("axios");

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "http://198.38.87.182/api/whatsapp/send";
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || "your-secret-key";

// === WhatsApp microservice integration ===
async function sendMessage(numbers, message) {
  try {
    const res = await axios.post(
      WHATSAPP_API_URL,
      { numbers, message },
      { headers: { "Content-Type": "application/json", "x-api-key": WHATSAPP_API_KEY } }
    );
    console.log(`📤 WhatsApp API response:`, res.data);
    return res.data;
  } catch (err) {
    console.error("❌ WhatsApp API error:", err.response?.data || err.message);
    throw new Error("Failed to send WhatsApp message");
  }
}

module.exports = { sendMessage };
