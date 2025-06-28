const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Faq = require('./models/Faq');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Faq.deleteMany();
    await Faq.insertMany([
      { question: 'pricing', answer: 'Our services start at ₹999.', department: 'sales' },
      { question: 'hours', answer: 'We’re open 9AM–6PM, Mon to Sat.', department: 'general' },
      { question: 'location', answer: 'We are at 123 Business Street, Mumbai.', department: 'general' },
      { question: 'book', answer: 'Please let us know your preferred time and service.', department: 'booking' },
    ]);
    console.log("✅ FAQs seeded");
    process.exit();
  })
  .catch(console.error);
