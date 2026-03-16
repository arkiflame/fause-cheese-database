const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cheese: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cheese',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
});

// A user can only rate a specific cheese once
ratingSchema.index({ user: 1, cheese: 1 }, { unique: true });

const Rating = mongoose.model('Rating', ratingSchema);
module.exports = Rating;
