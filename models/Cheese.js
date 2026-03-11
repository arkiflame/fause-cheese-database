const mongoose = require('mongoose');

const cheeseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  origin: {
    type: String,
    required: true
  },
  milk: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false // Optional description for now
  }
});

const Cheese = mongoose.model('Cheese', cheeseSchema);

module.exports = Cheese;