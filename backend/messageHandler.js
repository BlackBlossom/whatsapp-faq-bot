// backend/messageHandler.js
const axios = require('axios');
const genAI = require('@google/generative-ai');
const googleAI = new genAI.GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const Message = require('./models/Message');
const Faq = require('./models/Faq');
const prompts = require('./promptTemplates');

const detectDepartment = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes('book') || lower.includes('appointment')) return 'booking';
  if (lower.includes('price') || lower.includes('buy'))       return 'sales';
  if (lower.includes('problem') || lower.includes('error') ||
      lower.includes('issue'))                              return 'support';
  return 'general';
};

const handleMessage = async (phone, text) => {
  console.log('📩 Received message:', text, 'from:', phone);
  const department = detectDepartment(text);
  console.log('📁 Detected department:', department);

  let response = "Sorry, I couldn’t generate a proper reply.";
  let aiUsed   = false;

  // 1) Try AI via Gemini
  try {
    const model = googleAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent([
      prompts[department],
      text
    ]);
    response = result.response.text().trim();
    aiUsed   = true;
    console.log('🤖 Gemini response:', response);
  } catch (err) {
    console.warn('⚠️ Gemini API failed, falling back to static FAQ:', err.message);

    // 2) Fallback to static FAQ
    const match = await Faq.findOne({
      question:   text.toLowerCase().trim(),
      department
    });
    if (match) {
      response = match.answer;
      console.log('📚 FAQ match found:', response);
    } else {
      console.warn('📭 No FAQ matched.');
      response = "I'm sorry, I couldn't find an answer to that. Please rephrase your question.";
    }
  }

  // 3) Log the interaction
  await Message.create({ phone, text, response, aiUsed, department });

  // 4) Send back over WhatsApp
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
          'Content-Type':  'application/json'
        }
      }
    );
    console.log('✅ WhatsApp response sent successfully.');
  } catch (err) {
    console.error('❌ WhatsApp send error:', err.response?.data || err.message);
  }
};

const getLog = async () => {
  return await Message.find().sort({ time: -1 });
};

module.exports = { handleMessage, getLog };
