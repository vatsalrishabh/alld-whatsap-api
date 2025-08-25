require('dotenv').config();
const path = require('path');
const axios = require('axios');
const UserCase = require('../models/UserCase');
const { checkCaseChangesAndNotifyForCinoFromDB } = require('./highCourtAlld');

const HF_TOKEN = process.env.HF_TOKEN; // your Hugging Face token from .env
const HF_MODEL = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
const HF_INFERENCE_BASE = process.env.HF_INFERENCE_BASE || "https://api-inference.huggingface.co/models";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "http://198.38.87.182/api/whatsapp/send";
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || "your-secret-key";

// === HuggingFace AI function ===
async function getAIResponse(userMessage) {
  try {
    if (!HF_TOKEN) {
      console.error("AI error: Missing HF_TOKEN. Set it in your .env.");
      return "AI is not configured yet. Please try again later.";
    }
    const systemInstruction = "You are Vatsal Rishabh Pandey. Reply as if you are him. Keep it short, friendly, and natural.";
    const prompt = `${systemInstruction}\n\nUser: ${userMessage}\nAssistant:`;

    const url = `${HF_INFERENCE_BASE}/${encodeURIComponent(HF_MODEL)}`;
    const headers = {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json'
    };
    const body = {
      inputs: prompt,
      parameters: {
        max_new_tokens: 256,
        temperature: 0.7,
        return_full_text: false
      }
    };

    const response = await axios.post(url, body, { headers, timeout: 60000 });
    const data = response.data;

    let text = '';
    if (Array.isArray(data)) {
      text = data[0]?.generated_text || data[0]?.text || '';
    } else if (data && typeof data === 'object') {
      text = data.generated_text || data.text || data?.choices?.[0]?.text || '';
    }

    text = (text || '').toString().trim();
    if (!text) text = "Hmm, okay!";
    return text;
  } catch (error) {
    const status = error?.status || error?.response?.status;
    const data = error?.response?.data || error?.error || error?.message;
    console.error("AI error:", { status, data });
    return "Sorry, couldn't think of a reply!";
  }
}

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

module.exports = { getAIResponse, sendMessage };
