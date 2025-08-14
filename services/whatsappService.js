require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const axios = require('axios');
const UserCase = require('../models/UserCase');
const { checkCaseChangesAndNotifyForCinoFromDB } = require('./highCourtAlld');

let whatsappClient = null;
let lastQrCode = null;

const HF_TOKEN = process.env.HF_TOKEN; // your Hugging Face token from .env
const HF_MODEL = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
const HF_INFERENCE_BASE = process.env.HF_INFERENCE_BASE || "https://api-inference.huggingface.co/models";

// AI function
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

function startWhatsapp() {
    return new Promise((resolve, reject) => {
        if (whatsappClient) {
            console.log("WhatsApp client already initialized.");
            return resolve(whatsappClient);
        }

        console.log("Starting WhatsApp client...");

        whatsappClient = new Client({
            authStrategy: new LocalAuth({
                clientId: "main-session",
                dataPath: path.join(__dirname, '../.wwebjs_auth')
            }),
            puppeteer: { headless: true }
        });

        whatsappClient.on('qr', (qr) => {
            lastQrCode = qr;
            console.log('📲 Scan QR:', qr);
        });

        whatsappClient.on('authenticated', () => {
            console.log('✅ WhatsApp is authenticated!');
            lastQrCode = null;
        });

        whatsappClient.on('ready', () => {
            console.log('🚀 WhatsApp client is ready!');
            resolve(whatsappClient);
        });

        whatsappClient.on('message', async (msg) => {
            if (msg.fromMe) return;

            console.log(`📩 New message from ${msg.from}: ${msg.body}`);
            // Command format: "<phone>,cino,<CINO>" sent from 8123573669 only
            const body = (msg.body || '').trim();
            const senderDigits = String(msg.from).replace(/\D/g, '').replace(/^91/, '').slice(0, 10);
            const adminDigits = (process.env.ADMIN_NUMBER || '8123573669').replace(/\D/g, '');

            const parts = body.split(/\s*,\s*/);
            if (
                senderDigits === adminDigits &&
                parts.length === 3 &&
                /^\d{10}$/.test(parts[0]) &&
                /^cino$/i.test(parts[1]) &&
                parts[2].length >= 6
            ) {
                const phoneNumber = parts[0];
                const cino = parts[2].toUpperCase();
                try {
                    await UserCase.updateOne(
                        { phoneNumber, cino },
                        { $set: { phoneNumber, cino, active: true } },
                        { upsert: true }
                    );
                    await msg.reply(`Saved mapping: ${phoneNumber} ↔ ${cino}`);
                    // Trigger immediate check and notify if needed
                    await checkCaseChangesAndNotifyForCinoFromDB(cino);
                } catch (e) {
                    console.error('Failed to save UserCase:', e.message);
                    await msg.reply('Failed to save mapping.');
                }
                return;
            }

            const aiReply = await getAIResponse(body);
            await msg.reply(aiReply);
            console.log(`🤖 Replied: ${aiReply}`);
        });

        whatsappClient.on('disconnected', (reason) => {
            console.log('❌ WhatsApp disconnected:', reason);
            whatsappClient = null;
        });

        whatsappClient.initialize().catch(reject);
    });
}

function getWhatsappClient() {
    if (!whatsappClient) throw new Error("WhatsApp client not initialized.");
    return whatsappClient;
}

function getLastQrCode() {
    return lastQrCode;
}

async function sendMessage(to, message) {
    const client = await startWhatsapp();
    return client.sendMessage(to, message);
}

module.exports = { startWhatsapp, getWhatsappClient, getLastQrCode, sendMessage };
