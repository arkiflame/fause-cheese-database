require('dotenv').config();
const { scrapeCheeseFromUrl } = require('./lib/scraper');

async function test() {
    const urls = [
        'https://en.wikipedia.org/wiki/Brie',
        'https://en.wikipedia.org/wiki/Cheddar_cheese',
    ];

    for (const url of urls) {
        console.log(`Scraping ${url}...`);
        const res = await scrapeCheeseFromUrl(url);
        console.log(res);
    }
}

test();
