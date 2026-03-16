const mongoose = require('mongoose');

const cheeseListSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  cheeses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cheese'
  }]
}, { timestamps: true });

const CheeseList = mongoose.model('CheeseList', cheeseListSchema);
module.exports = CheeseList;
