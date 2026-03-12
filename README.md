# Fause | The Cheese Database

A simple web app for managing a cheese collection. Add, view, and delete cheeses with name, origin, milk type, and description.

## Tech Stack

- **Backend:** Node.js, Express 5, Mongoose, MongoDB
- **Frontend:** Vanilla HTML, CSS, JavaScript

## Features

- Add cheeses via form (Archive and Add Cheese tabs)
- **Import from URL** — paste a link to scrape cheese info and pre-fill the form (uses Gemini for descriptions when `GEMINI_API_KEY` is set)
- View all cheeses in a card grid
- Delete cheeses with confirmation
- Dark theme UI

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file:
   ```
   MONGODB_URI=mongodb+srv://...
   GEMINI_API_KEY=...   # Optional: enables LLM-generated descriptions when scraping (free key at aistudio.google.com/apikey)
   ```

3. Run the server:
   ```bash
   node server.js
   ```

4. Open `http://localhost:3000`

## Scraper & LLM

When you paste a URL in **Add Cheese → Import from URL** and click Fetch, the app scrapes the page for cheese info. If `GEMINI_API_KEY` is set in `.env`, it uses Google Gemini to generate a coherent 3-sentence description (origin, flavour, texture). Otherwise it falls back to heuristic extraction. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).

## What's Next

- Deployment
