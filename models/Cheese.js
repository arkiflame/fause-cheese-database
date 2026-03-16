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
  },
  status: {
    type: String,
    enum: ['verified', 'pending_verification', 'rejected'],
    default: 'verified'
  }
});

// Case-insensitive index for name
cheeseSchema.index({ name: 1 }, { collation: { locale: 'en', strength: 2 }, unique: true });

const Cheese = mongoose.model('Cheese', cheeseSchema);

module.exports = Cheese;