const cheerio = require('cheerio');
const { generateCheeseDescription } = require('./llm');

/** Remove source suffixes from names (e.g. "Wensleydale - Wikipedia" → "Wensleydale") */
function cleanName(name) {
  if (!name || typeof name !== 'string') return name;
  return name
    .replace(/\s*[-–—|]\s*(Wikipedia|Wikiwand|Wiktionary|Wikimedia|\.\.\.).*$/i, '')
    .trim() || name.trim();
}

/** Keywords for each sentence type (with g for counting matches) */
const ORIGIN_KEYWORDS = /\b(origin|originates|from|produced in|made in|comes from|region|county|village|dales|valley)\b/gi;
const FLAVOUR_KEYWORDS = /\b(flavour|flavor|taste|tastes|tangy|nutty|sharp|mild|sweet|salty|pungent|buttery|earthy|fruity|peppery|smoky|delicate|complex|grassy|caramel|herbaceous|savoury)\b/gi;
const TEXTURE_KEYWORDS = /\b(texture|creamy|firm|soft|crumbly|smooth|waxy|melting|crusty|rind|aged|matured|moist|dry|velvety|grainy)\b/gi;

const MAX_SENTENCE_LEN = 120;
const BOILERPLATE = /\b(from wikipedia|the free encyclopedia|edit \| edit source|jump to navigation)\b/gi;

/** Trim a sentence to max length, breaking at word/sentence boundary. */
function trimSentence(s, max = MAX_SENTENCE_LEN) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const lastPeriod = cut.lastIndexOf('.');
  const lastSpace = cut.lastIndexOf(' ');
  if (lastPeriod > 50) return cut.slice(0, lastPeriod + 1).trim();
  if (lastSpace > 50) return cut.slice(0, lastSpace).trim() + '.';
  return cut.trim() + '.';
}

/** Collect all sentences from main content paragraphs. */
function collectSentences($) {
  const hasMain = $('#mw-content-text p, .mw-parser-output > p, main p, article p').length > 0;
  const paras = hasMain ? $('#mw-content-text p, .mw-parser-output > p, main p, article p') : $('p');
  const out = [];
  paras.slice(0, 15).each((_, el) => {
    const text = $(el).text().replace(BOILERPLATE, '').replace(/\s+/g, ' ').trim();
    if (text.length < 35) return;
    text.split(/(?<=[.!?])\s+/).forEach((s) => {
      s = s.trim();
      if (s.length >= 25 && s.length <= 250) out.push(s);
    });
  });
  return out;
}

/** Extract main page text for LLM (first ~2500 chars). */
function extractPageTextForLlm($) {
  const BOILERPLATE = /\b(from wikipedia|the free encyclopedia|edit \| edit source|jump to navigation)\b/gi;
  const hasMain = $('#mw-content-text p, .mw-parser-output > p, main p, article p').length > 0;
  const paras = hasMain ? $('#mw-content-text p, .mw-parser-output > p, main p, article p') : $('p');
  const parts = [];
  let len = 0;
  paras.slice(0, 12).each((_, el) => {
    if (len >= 2500) return false;
    const text = $(el).text().replace(BOILERPLATE, '').replace(/\s+/g, ' ').trim();
    if (text.length > 20) {
      parts.push(text);
      len += text.length;
    }
  });
  return parts.join(' ').slice(0, 2500);
}

/** Pick best sentence for a category; adds chosen sentence to exclude set. */
function pickBest(sentences, keywords, exclude) {
  let best = null;
  let bestScore = 0;
  for (const s of sentences) {
    if (exclude && exclude.has(s)) continue;
    const matches = s.match(keywords);
    const score = matches ? matches.length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (best && exclude) exclude.add(best);
  return best ? trimSentence(best) : null;
}

/** Build three-sentence description: origin, flavour, texture. */
function buildThreeSentenceDescription($, origin, name, milk) {
  const sentences = collectSentences($);
  const used = new Set();

  const originSentence = pickBest(sentences, ORIGIN_KEYWORDS, used) ||
    (origin ? `It originates from ${origin}.` : null);

  const flavourSentence = pickBest(sentences, FLAVOUR_KEYWORDS, used);

  const textureSentence = pickBest(sentences, TEXTURE_KEYWORDS, used);

  const parts = [originSentence, flavourSentence, textureSentence].filter(Boolean);

  if (parts.length === 0) {
    const milkStr = milk ? `${milk} milk ` : '';
    const originStr = origin ? ` from ${origin}` : '';
    return `${name || 'This cheese'} is a ${milkStr}cheese${originStr}.`;
  }

  return parts.join(' ');
}

/**
 * Fetch a URL and extract cheese-related info from the page.
 * Tries JSON-LD, meta tags, and heuristics on the page content.
 */
async function scrapeCheeseFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FauseCheeseBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const result = {
    name: null,
    origin: null,
    milk: null,
    description: null,
    confidence: null,
    issues: [],
  };

  // 1. Try JSON-LD (Product, Food, or generic)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const data = Array.isArray(json) ? json[0] : json;
      if (!data) return;

      if (data['@type']?.includes?.('Product') || data['@type']?.includes?.('Food')) {
        if (!result.name && data.name) result.name = String(data.name).trim();
        if (!result.description && data.description) result.description = String(data.description).trim();
        if (data.origin && !result.origin) result.origin = String(data.origin).trim();
      }
    } catch (_) {}
  });

  // 2. Meta tags
  if (!result.name) {
    result.name = $('meta[property="og:title"]').attr('content')?.trim() ||
      $('meta[name="twitter:title"]').attr('content')?.trim();
  }
  if (!result.description) {
    result.description = $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[name="twitter:description"]').attr('content')?.trim();
  }
  if (!result.name) {
    result.name = $('title').text()?.trim() || $('h1').first().text()?.trim();
  }

  // 3. Heuristics: search page text for origin and milk
  const bodyText = $('body').text().toLowerCase();
  const lines = bodyText.split(/\s*[\n\r]+\s*/);

  const originPatterns = [
    /(?:origin|country|from|produced in|made in)[\s:]+([^\n.,]+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(?:France|Italy|Spain|Switzerland|Netherlands|England|USA|UK)/i,
  ];

  const milkPatterns = [
    /(?:milk|made from)[\s:]+(cow|goat|sheep|buffalo|raw\s+milk|pasteurized)/i,
    /(cow|goat|sheep|buffalo)\s+(?:milk|cheese)/i,
    /(?:cow's|goat's|sheep's|buffalo's)\s+milk/i,
  ];

  if (!result.origin) {
    for (const line of lines) {
      for (const re of originPatterns) {
        const m = line.match(re);
        if (m && m[1]?.trim().length > 1 && m[1].trim().length < 50) {
          result.origin = m[1].trim();
          break;
        }
      }
      if (result.origin) break;
    }
    // Fallback: common cheese countries
    const countries = ['france', 'italy', 'spain', 'switzerland', 'netherlands', 'england', 'usa', 'greece', 'germany'];
    for (const c of countries) {
      if (bodyText.includes(c)) {
        result.origin = c.charAt(0).toUpperCase() + c.slice(1);
        break;
      }
    }
  }

  if (!result.milk) {
    for (const line of lines) {
      for (const re of milkPatterns) {
        const m = line.match(re);
        if (m) {
          const milk = (m[1] || m[0]).trim().toLowerCase();
          if (milk.includes("cow")) result.milk = "Cow";
          else if (milk.includes("goat")) result.milk = "Goat";
          else if (milk.includes("sheep")) result.milk = "Sheep";
          else if (milk.includes("buffalo")) result.milk = "Buffalo";
          else if (milk.length > 2) result.milk = milk.charAt(0).toUpperCase() + milk.slice(1);
          break;
        }
      }
      if (result.milk) break;
    }
  }

  // Clean name (remove " - Wikipedia", etc.)
  if (result.name) result.name = cleanName(result.name);

  // Use LLM to infer full structured info (name, origin, milk, description, confidence, issues)
  const pageText = extractPageTextForLlm($);
  const llmResult = await generateCheeseDescription(pageText, {
    name: result.name,
    origin: result.origin,
    milk: result.milk,
  });

  if (llmResult && typeof llmResult === 'object') {
    if (llmResult.name) result.name = llmResult.name;
    if (llmResult.origin) result.origin = llmResult.origin;
    if (llmResult.milk) result.milk = llmResult.milk;
    if (llmResult.description) result.description = llmResult.description;
    result.confidence = llmResult.confidence;
    result.issues = Array.isArray(llmResult.issues) ? llmResult.issues : [];
  }

  // If LLM failed or did not provide a description, fall back to heuristic description
  if (!result.description) {
    result.description = buildThreeSentenceDescription(
      $,
      result.origin,
      result.name,
      result.milk
    );
  }

  return result;
}

module.exports = { scrapeCheeseFromUrl };
