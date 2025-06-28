const mongoose = require('mongoose');

const FaqSchema = new mongoose.Schema({
  question: String,
  answer: String,
  department: String,
});

module.exports = mongoose.model('Faq', FaqSchema);
