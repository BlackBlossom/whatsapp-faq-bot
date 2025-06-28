// backend/messageHandler.js
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const Message = require('./models/Message');
const Faq     = require('./models/Faq');
const prompts = require('./promptTemplates');

function detectDepartment(text) {
  const lower = text.toLowerCase();
  if (lower.includes('book') || lower.includes('appointment')) return 'booking';
  if (lower.includes('price') || lower.includes('buy'))       return 'sales';
  if (lower.includes('problem')|| lower.includes('error') ||
      lower.includes('issue'))                              return 'support';
  return 'general';
}

async function handleMessage(phone, text) {
  console.log('📩 Received:', text, 'from:', phone);
  const department = detectDepartment(text);
  console.log('📁 Dept:', department);

  let response = "Sorry, I couldn’t generate a proper reply.";
  let aiUsed   = false;

  // 1) Try Gemini AI
  try {
    const result = await ai.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: [ prompts[department], text ]
    });
    response = result.text.trim();
    aiUsed   = true;
    console.log('🤖 Gemini reply:', response);

  } catch (err) {
    console.warn('⚠️ Gemini failed, falling back to FAQ:', err.message);

    // 2) Static FAQ fallback
    const match = await Faq.findOne({
      question:   text.toLowerCase().trim(),
      department
    });
    if (match) {
      response = match.answer;
      console.log('📚 FAQ hit:', response);
    } else {
      console.warn('📭 No FAQ match.');
      response = "I'm sorry, I couldn't find an answer. Please rephrase.";
    }
  }

  // 3) Log interaction
  await Message.create({ phone, text, response, aiUsed, department });

  // 4) Send via WhatsApp Cloud API
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

async function getLog() {
  return await Message.find().sort({ time: -1 });
}

module.exports = { handleMessage, getLog };
