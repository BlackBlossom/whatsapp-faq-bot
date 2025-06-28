const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  phone: String,
  text: String,
  response: String,
  aiUsed: Boolean,
  department: String,
  time: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
