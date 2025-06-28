// listModels.js
const genAI = require('@google/generative-ai');
const googleAI = new genAI.GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
  try {
    const models = await googleAI.listModels();
    console.log(models);
  } catch (err) {
    console.error(err);
  }
}

list();
