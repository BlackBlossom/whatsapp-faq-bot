const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(bodyParser.json());

const verify = require('./verify');
const { handleMessage, getLog } = require('./messageHandler');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ DB Connection Error:", err));

// Webhook Verification
app.get('/webhook', verify);

// Incoming Message Handler
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (message && message.from && message.text?.body) {
      const phone = message.from;
      const text = message.text.body;
      console.log("📩 Webhook received message:", text, "from:", phone);
      await handleMessage(phone, text);
    } else {
      console.log("⚠️ No valid message found in webhook payload.");
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error in webhook handler:", error.message);
    res.sendStatus(500);
  }
});

// Logs Route
app.get('/logs', async (req, res) => {
  try {
    const logs = await getLog();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
