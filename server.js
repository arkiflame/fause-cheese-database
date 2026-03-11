require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Cheese = require('./models/Cheese');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware so our API can understand JSON data
app.use(express.json());

// Connect to MongoDB using Mongoose
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

// A simple test route to make sure our API works
app.get('/api/test', (req, res) => {
  res.json({ message: 'The Cheese API is up and running!' });
});

// Serve static files from the "public" folder
app.use(express.static('public'));

// POST Route: Add a new cheese to the database
app.post('/api/cheeses', async (req, res) => {
  try {
    // 1. Get the data sent in the request body
    const cheeseData = req.body;

    // 2. Use the Model to create a new cheese document
    const newCheese = new Cheese(cheeseData);

    // 3. Save it to MongoDB
    const savedCheese = await newCheese.save();

    // 4. Send a success response back
    res.status(201).json(savedCheese);
  } catch (error) {
    // If something goes wrong (like missing a required field)
    res.status(400).json({ message: 'Error adding cheese', error: error.message });
  }
});

// GET Route: Fetch all cheeses from the database
app.get('/api/cheeses', async (req, res) => {
  try {
    // .find() is a Mongoose command that gets every document in a collection
    const allCheeses = await Cheese.find();
    
    // Send the list back to the user
    res.status(200).json(allCheeses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cheeses', error: error.message });
  }
});

// DELETE Route: Remove a cheese by its ID
app.post('/api/cheeses/delete/:id', async (req, res) => {
  try {
    const deletedCheese = await Cheese.findByIdAndDelete(req.params.id);
    if (!deletedCheese) {
      return res.status(404).json({ message: 'Cheese not found' });
    }
    res.json({ message: 'Cheese deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting cheese', error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});