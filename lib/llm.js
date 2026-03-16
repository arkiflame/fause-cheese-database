/**
 * Generate structured cheese info using Google Gemini.
 * Requires GEMINI_API_KEY in .env.
 * Get a free key at https://aistudio.google.com/apikey
 *
 * Returns an object like:
 * {
 *   name: string,
 *   origin: string | null,
 *   milk: string | null,
 *   description: string,
 *   confidence: number (0-1),
 *   issues: string[]
 * }
 */

async function generateCheeseDescription(pageText, cheeseInfo) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { name, origin, milk } = cheeseInfo || {};
  const info = [name && `Name: ${name}`, origin && `Origin: ${origin}`, milk && `Milk: ${milk}`]
    .filter(Boolean)
    .join('. ');

  const prompt = `You are helping build a cheese database.

Given the following excerpt from a webpage about a cheese, extract structured information and return ONLY valid JSON with this exact shape:

{
  "name": "Cheese name as humans would call it",
  "origin": "Region or country it is from, or null if unknown",
  "milk": "One of: Cow, Goat, Sheep, Buffalo, Mixed, or null if unknown",
  "description": "Three short sentences. 1) Origin. 2) Flavour. 3) Texture.",
  "confidence": 0.0-1.0 overall confidence as a number,
  "issues": ["short bullet points explaining any guesses, gaps, or contradictions"]
}

Rules:
- Use information from the excerpt when possible.
- If you must guess, admit it in the issues list.
- If something is not stated clearly, set the field to null.
- Description must be exactly three sentences, each under 25 words.
- DO NOT include any text before or after the JSON.

Known hints (may be empty): ${info || 'none'}

Webpage excerpt:
${pageText.slice(0, 2500)}`;

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const raw = response?.text?.trim();
    if (!raw) return null;

    // Ensure we only parse the JSON portion
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;

    const jsonString = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') return null;

    return {
      name: parsed.name || null,
      origin: parsed.origin || null,
      milk: parsed.milk || null,
      description: parsed.description || '',
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.min(1, Math.max(0, parsed.confidence))
          : null,
      issues: Array.isArray(parsed.issues) ? parsed.issues.filter((i) => typeof i === 'string') : [],
    };
  } catch (err) {
    console.error('LLM description error:', err.message);
    return null;
  }
}

module.exports = { generateCheeseDescription };
