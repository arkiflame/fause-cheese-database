require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Cheese = require('./models/Cheese');
const User = require('./models/User');
const Rating = require('./models/Rating');
const CheeseList = require('./models/CheeseList');
const { verifyToken, optionalVerifyToken } = require('./lib/auth');
const { scrapeCheeseFromUrl } = require('./lib/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware so our API can understand JSON data
app.use(express.json());

// Serve static files from the "public" folder (important to be before most routes)
app.use(express.static('public'));

// Connect to MongoDB using Mongoose
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

// A simple test route to make sure our API works
app.get('/api/test', (req, res) => {
  res.json({ message: 'The Cheese API is up and running!' });
});

// Auth Route: Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || password.length < 6) {
      return res.status(400).json({ message: 'Username (min 3) and password (min 6) required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Auth Route: Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const payload = {
      id: user._id,
      username: user.username,
    };
    
    const defaultSecret = 'fallback_secret_key_for_development'; // Replace in prod
    const secret = process.env.JWT_SECRET || defaultSecret;

    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    res.json({ message: 'Logged in successfully', token, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// POST Route: Scrape cheese info from a URL
app.post('/api/scrape', verifyToken, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL is required' });
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ message: 'Only http and https URLs are allowed' });
    }
    const data = await scrapeCheeseFromUrl(url);

    // After scraping, before returning to client, check if we already have it
    if (data.name) {
        const exists = await Cheese.findOne({ name: { $regex: new RegExp(`^${data.name}$`, 'i') } });
        if (exists) {
            return res.status(400).json({ message: `A cheese named "${data.name}" already exists in the database.` });
        }
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Scraping failed', error: error.message });
  }
});

// POST Route: Bulk import cheeses from a list of URLs
app.post('/api/import', verifyToken, async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ message: 'urls must be a non-empty array of strings' });
    }

    const results = [];
    const concurrency = 5;

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (rawUrl) => {
        if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
          return { url: rawUrl, status: 'skipped', reason: 'Invalid URL string' };
        }

        try {
          const parsed = new URL(rawUrl);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { url: rawUrl, status: 'skipped', reason: 'Only http/https allowed' };
          }

          const scraped = await scrapeCheeseFromUrl(rawUrl);
          if (!scraped || !scraped.name) {
            return { url: rawUrl, status: 'failed', reason: 'No cheese name extracted' };
          }

          // Case-insensitive uniqueness check
          const exists = await Cheese.findOne({ name: { $regex: new RegExp(`^${scraped.name}$`, 'i') } });
          if (exists) {
            return { url: rawUrl, status: 'skipped', reason: 'Duplicate cheese name' };
          }

          let finalStatus = 'rejected';
          if (scraped.confidence !== null && scraped.confidence > 0.4) {
              finalStatus = 'verified';
          } else if (scraped.confidence === null) {
              // LLM failed (e.g., 503 error), evaluate based on heuristic scrape success
              if (scraped.name && scraped.origin && scraped.origin !== 'Unknown' && 
                  scraped.milk && scraped.milk !== 'Unknown' && scraped.description.length > 20) {
                  finalStatus = 'verified';
              }
          }

          const cheeseDoc = new Cheese({
            name: scraped.name,
            origin: scraped.origin || 'Unknown',
            milk: scraped.milk || 'Unknown',
            description: scraped.description || '',
            status: finalStatus
          });

          await cheeseDoc.save();
          return {
            url: rawUrl,
            status: 'imported',
            cheeseId: cheeseDoc._id,
            confidence: scraped.confidence ?? null,
            issues: scraped.issues ?? [],
          };
        } catch (err) {
          return { url: rawUrl, status: 'error', reason: err.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const summary = {
      imported: results.filter(r => r.status === 'imported').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    };

    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Bulk import failed', error: error.message });
  }
});

// POST Route: Import cheeses directly from JSON array (equivalent to CSV)
app.post('/api/import/csv', verifyToken, async (req, res) => {
  try {
    const { cheeses } = req.body;
    if (!Array.isArray(cheeses) || cheeses.length === 0) {
      return res.status(400).json({ message: 'cheeses must be a non-empty array of objects' });
    }

    const results = [];
    for (const data of cheeses) {
      try {
        if (!data.name || typeof data.name !== 'string') {
           results.push({ name: data.name, status: 'skipped', reason: 'Invalid or missing name' });
           continue;
        }

        const exists = await Cheese.findOne({ name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') } });
        if (exists) {
            results.push({ name: data.name, status: 'skipped', reason: 'Duplicate cheese name' });
            continue;
        }

        const cheeseDoc = new Cheese({
          name: data.name.trim(),
          origin: data.origin ? String(data.origin).trim() : 'Unknown',
          milk: data.milk ? String(data.milk).trim() : 'Unknown',
          description: data.description ? String(data.description).trim() : '',
          status: 'verified' // Assume CSV imports are admin/verified
        });

        await cheeseDoc.save();
        results.push({
          name: data.name.trim(),
          status: 'imported',
          cheeseId: cheeseDoc._id,
        });
      } catch (err) {
        results.push({ name: data.name, status: 'error', reason: err.message });
      }
    }

    const summary = {
      imported: results.filter(r => r.status === 'imported').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    };

    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: 'CSV import failed', error: error.message });
  }
});

// POST Route: Add a new cheese to the database
app.post('/api/cheeses', verifyToken, async (req, res) => {
  try {
    // 1. Get the data sent in the request body
    const cheeseData = req.body;
    
    // Check for duplicate
    const exists = await Cheese.findOne({ name: { $regex: new RegExp(`^${cheeseData.name}$`, 'i') } });
    if (exists) {
        return res.status(400).json({ message: 'A cheese with this name already exists' });
    }

    // 2. Use the Model to create a new cheese document
    // If not admin, maybe pending? We will just set manual creation to verified for now
    const newCheese = new Cheese({ ...cheeseData, status: 'verified' });

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
app.get('/api/cheeses', optionalVerifyToken, async (req, res) => {
  try {
    const allCheeses = await Cheese.find().lean();
    
    // Attach average ratings and user ratings
    const cheesesWithRatings = await Promise.all(allCheeses.map(async (cheese) => {
      const ratings = await Rating.find({ cheese: cheese._id });
      let avgRating = 0;
      let userRating = null;
      
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, r) => acc + r.score, 0);
        avgRating = sum / ratings.length;
      }
      
      if (req.user) {
        const ur = ratings.find(r => r.user.toString() === req.user.id);
        if (ur) userRating = ur.score;
      }
      
      return { ...cheese, avgRating, totalRatings: ratings.length, userRating };
    }));
    
    res.status(200).json(cheesesWithRatings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cheeses', error: error.message });
  }
});

// POST Route: Rate a cheese
app.post('/api/cheeses/:id/rate', verifyToken, async (req, res) => {
  try {
    const cheeseId = req.params.id;
    const userId = req.user.id;
    const { score } = req.body;

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ message: 'Score must be between 1 and 5' });
    }

    const cheese = await Cheese.findById(cheeseId);
    if (!cheese) {
      return res.status(404).json({ message: 'Cheese not found' });
    }

    // Upsert the rating
    const rating = await Rating.findOneAndUpdate(
      { user: userId, cheese: cheeseId },
      { score },
      { new: true, upsert: true } // Create if it doesn't exist, otherwise update
    );

    res.json({ message: 'Rating saved', rating });
  } catch (error) {
    res.status(500).json({ message: 'Error saving rating', error: error.message });
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

// DELETE ALL Route: Remove all cheeses
app.post('/api/cheeses/clear', async (req, res) => {
  try {
    await Cheese.deleteMany({});
    res.json({ message: 'All cheeses deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cheeses', error: error.message });
  }
});

// LISTS: Create a new list
app.post('/api/lists', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'List name is required' });
    }
    const newList = new CheeseList({ user: req.user.id, name: name.trim() });
    await newList.save();
    res.status(201).json(newList);
  } catch (error) {
    res.status(500).json({ message: 'Error creating list', error: error.message });
  }
});

// LISTS: Get all lists for logged in user (populated with cheeses)
app.get('/api/lists', verifyToken, async (req, res) => {
  try {
    const lists = await CheeseList.find({ user: req.user.id }).populate('cheeses');
    res.json(lists);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lists', error: error.message });
  }
});

// LISTS: Add a cheese to a list
app.post('/api/lists/:listId/add/:cheeseId', verifyToken, async (req, res) => {
  try {
    const { listId, cheeseId } = req.params;
    const list = await CheeseList.findOne({ _id: listId, user: req.user.id });
    
    if (!list) {
      return res.status(404).json({ message: 'List not found or unauthorized' });
    }

    const index = list.cheeses.indexOf(cheeseId);
    if (index > -1) {
      return res.status(400).json({ message: 'Cheese is already in this list' });
    }
    
    list.cheeses.push(cheeseId);
    await list.save();
    res.json({ message: 'Added cheese to list', list });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to list', error: error.message });
  }
});

// LISTS: Remove a cheese from a list
app.post('/api/lists/:listId/remove/:cheeseId', verifyToken, async (req, res) => {
  try {
    const { listId, cheeseId } = req.params;
    const list = await CheeseList.findOne({ _id: listId, user: req.user.id });
    
    if (!list) {
      return res.status(404).json({ message: 'List not found or unauthorized' });
    }

    const index = list.cheeses.indexOf(cheeseId);
    if (index > -1) {
      list.cheeses.splice(index, 1);
      await list.save();
      return res.json({ message: 'Removed cheese from list', list });
    }
    
    res.status(400).json({ message: 'Cheese was not in this list' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from list', error: error.message });
  }
});

// LISTS: Delete a list
app.delete('/api/lists/:id', verifyToken, async (req, res) => {
  try {
    const deleted = await CheeseList.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'List not found' });
    res.json({ message: 'List deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting list', error: error.message });
  }
});


app.use((req, res, next) => {
  console.log('404 on:', req.method, req.url);
  res.status(404).json({ message: 'Route not found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});