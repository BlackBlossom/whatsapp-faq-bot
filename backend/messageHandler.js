const axios = require('axios');
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const Message = require('./models/Message');
const Faq = require('./models/Faq');
const prompts = require('./promptTemplates');

const detectDepartment = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("book") || lower.includes("appointment")) return "booking";
  if (lower.includes("price") || lower.includes("buy")) return "sales";
  if (lower.includes("problem") || lower.includes("error") || lower.includes("issue")) return "support";
  return "general";
};

const handleMessage = async (phone, text) => {
  console.log("📩 Received message:", text, "from:", phone);

  const department = detectDepartment(text);
  console.log("📁 Detected department:", department);

  let response = "Sorry, I couldn’t generate a proper reply.";
  let aiUsed = false;

  try {
    // AI Response
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompts[department] },
        { role: "user", content: text },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    if (aiResponse.choices && aiResponse.choices.length > 0) {
      response = aiResponse.choices[0].message.content.trim();
      aiUsed = true;
      console.log("🧠 AI response:", response);
    } else {
      console.warn("⚠️ AI responded with no choices.");
    }

  } catch (err) {
    console.warn("⚠️ AI failed, trying static FAQ fallback.", err.message);

    const match = await Faq.findOne({
      question: text.toLowerCase().trim(),
      department,
    });

    if (match) {
      response = match.answer;
      console.log("📚 FAQ match found:", response);
    } else {
      response = "I'm sorry, I couldn't find an answer to that. Please rephrase your question.";
      console.warn("📭 No FAQ matched.");
    }
  }

  // Log to DB
  await Message.create({ phone, text, response, aiUsed, department });

  // Send to WhatsApp
  try {
    const sendRes = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone, // ensure phone is in E.164 format, no '+'
        text: { body: response },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log("✅ WhatsApp response sent successfully.");
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err.message);
  }
};

const getLog = async () => {
  return await Message.find().sort({ time: -1 });
};

module.exports = { handleMessage, getLog };
