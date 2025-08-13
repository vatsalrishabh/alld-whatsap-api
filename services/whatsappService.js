require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

// ✅ Import OpenAI SDK and pass our HF key manually
const OpenAI = require('openai');

let whatsappClient = null;
let lastQrCode = null;

const HF_TOKEN = process.env.HF_TOKEN; // your Hugging Face token from .env
const HF_MODEL = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.2:featherless-ai";

// ✅ Tell OpenAI SDK to use HF instead of OPENAI_API_KEY
const hfClient = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: HF_TOKEN // manually set so it won't look for OPENAI_API_KEY
});

// AI function
async function getAIResponse(userMessage) {
    try {
        const completion = await hfClient.chat.completions.create({
            model: HF_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are Vatsal Rishabh Pandey. Reply as if you are him. Keep it short, friendly, and natural."
                },
                {
                    role: "user",
                    content: userMessage
                }
            ]
        });

        return completion.choices[0]?.message?.content?.trim() || "Hmm, okay!";
    } catch (error) {
        console.error("AI error:", error.message);
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
            const aiReply = await getAIResponse(msg.body);
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
