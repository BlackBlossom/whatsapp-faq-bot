// backend/messageHandler.js
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const Message = require('./models/Message');
const Faq     = require('./models/Faq');
const prompts = require('./promptTemplates');

// Pull last N messages (both user and bot) for context
async function fetchHistory(phone, limit = 5) {
  // Get latest 'limit' entries, then reverse so oldest is first
  const docs = await Message.find({ phone })
                            .sort({ time: -1 })
                            .limit(limit);
  return docs.reverse().map(doc => {
    const speaker = doc.aiUsed ? 'Assistant' : 'User';
    return `${speaker}: ${doc.aiUsed ? doc.response : doc.text}`;
  });
}

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

  // 1) Build contents with:
  //    a) your system prompt for this intent
  //    b) recent chat history
  //    c) the new user message
  const history = await fetchHistory(phone, 5);  
  const contents = [
    prompts[intent],
    ...history,
    `User: "${text}"`
  ];

  // 2) Attempt AI reply with context
  try {
    const result = await ai.models.generateContent({
      model:    'gemini-2.5-flash',
      contents
    });
    response = result.text.trim();
    aiUsed   = true;
    console.log('🤖 AI reply:', response);

  } catch (err) {
    console.warn('⚠️ Gemini failed, falling back to FAQ:', err.message);
    const match = await Faq.findOne({
      question:   text.toLowerCase().trim(),
      department: intent
    });
    if (match) {
      response = match.answer;
      console.log('📚 FAQ hit:', response);
    }
  }

  // 3) Log the chat (for future context)
  await Message.create({ phone, text, response, aiUsed, department: intent });

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

const getLog = async () => {
  return await Message.find().sort({ time: -1 });
};

module.exports = { handleMessage, getLog };
