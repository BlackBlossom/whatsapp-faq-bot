// backend/messageHandler.js
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const Message = require('./models/Message');
const Faq     = require('./models/Faq');
const prompts = require('./promptTemplates');

function detectIntent(text) {
  const lower = text.toLowerCase();
  if (/order\s*#?\d+/.test(lower))                           return 'order';
  if (lower.includes('recommend') || lower.includes('suggest')) return 'recommend';
  if (lower.includes('return') || lower.includes('refund'))     return 'returns';
  if (/about|features|tell me about/.test(lower))             return 'product';
  return 'general';
}

async function handleMessage(phone, text) {
  console.log('📩 Received:', text, 'from:', phone);
  const intent = detectIntent(text);
  console.log('📁 Intent:', intent);

  let response = "Sorry, I couldn’t generate a proper reply.";
  let aiUsed   = false;

  // Try AI for every intent
  try {
    const result = await ai.models.generateContent({
      model:    'gemini-2.5-flash',            // or another supported model
      contents: [
        prompts[intent],                       // your curated system prompt
        `User: "${text}"`                      // user’s message
      ]
    });
    response = result.text.trim();
    aiUsed   = true;
    console.log('🤖 AI reply:', response);

  } catch (err) {
    console.warn('⚠️ Gemini API failed, falling back to FAQ:', err.message);
    const match = await Faq.findOne({
      question:   text.toLowerCase().trim(),
      department: intent
    });
    if (match) {
      response = match.answer;
      console.log('📚 FAQ hit:', response);
    }
  }

  // Log the chat
  await Message.create({ phone, text, response, aiUsed, department: intent });

  // Send via WhatsApp Cloud API
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        text: { body: response }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Sent back to WhatsApp');
  } catch (err) {
    console.error('❌ WhatsApp send error:', err.response?.data || err.message);
  }
}

const getLog = async () => {
  return await Message.find().sort({ time: -1 });
};

module.exports = { handleMessage, getLog };
