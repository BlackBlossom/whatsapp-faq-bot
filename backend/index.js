const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
const app = express();
app.use(bodyParser.json());

const verify = require('./verify');
const { handleMessage, getLog } = require('./messageHandler');

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ DB Error:", err));

// Routes
app.get('/webhook', verify);

app.post('/webhook', async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (message && message.text?.body) {
    const phone = message.from;
    const text = message.text.body;
    await handleMessage(phone, text);
  }
  res.sendStatus(200);
});

app.get('/logs', async (req, res) => {
  const logs = await getLog();
  res.json(logs);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
