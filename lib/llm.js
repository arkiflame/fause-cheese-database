/**
 * Generate a cheese description using Google Gemini.
 * Requires GEMINI_API_KEY in .env.
 * Get a free key at https://aistudio.google.com/apikey
 */

async function generateCheeseDescription(pageText, cheeseInfo) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { name, origin, milk } = cheeseInfo;
  const info = [name && `Name: ${name}`, origin && `Origin: ${origin}`, milk && `Milk: ${milk}`]
    .filter(Boolean)
    .join('. ');

  const prompt = `You are writing a cheese database entry. Given the following excerpt from a webpage about a cheese, write exactly 3 short sentences for the description:

1) Origin – where the cheese comes from (region, country, or place).
2) Flavour – how it tastes (e.g. tangy, nutty, mild, sharp).
3) Texture – how it feels (e.g. creamy, crumbly, firm, soft).

Be concise. Each sentence should be under 25 words. Write only the 3 sentences, no preamble or labels.

Known facts (use if relevant): ${info}

Webpage excerpt:
${pageText.slice(0, 2500)}`;

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = response?.text?.trim();
    return text || null;
  } catch (err) {
    console.error('LLM description error:', err.message);
    return null;
  }
}

module.exports = { generateCheeseDescription };
