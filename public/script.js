// Tab switching
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        panels.forEach((p, i) => {
            p.classList.toggle('active', i === index);
            p.hidden = i !== index;
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
    });
});

// Scrape from URL (auto + button)
async function runScrapeFromUrl() {
    const urlInput = document.getElementById('scrape-url');
    const messageEl = document.getElementById('scrape-message');
    const btn = document.getElementById('scrape-btn');
    const url = urlInput.value.trim();

    if (!url) {
        messageEl.textContent = 'Please enter a URL';
        messageEl.className = 'form-message error';
        return;
    }

    messageEl.textContent = 'Scraping and asking Gemini...';
    messageEl.className = 'form-message';
    if (btn) btn.disabled = true;

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();

        if (response.ok) {
            const form = document.getElementById('add-cheese-form');
            form.name.value = data.name || '';
            form.origin.value = data.origin || '';
            form.milk.value = data.milk || '';
            form.description.value = data.description || '';

            let message = 'Form filled! Review carefully, then add below.';
            if (typeof data.confidence === 'number') {
                const pct = Math.round(data.confidence * 100);
                message = `Gemini filled this in (confidence ~${pct}%). Review carefully, then add below.`;
            }
            if (Array.isArray(data.issues) && data.issues.length) {
                message += ` Issues: ${data.issues.join(' | ')}`;
            }

            messageEl.textContent = message;
            messageEl.className = 'form-message success';
        } else {
            messageEl.textContent = data.message || data.error || 'Scraping failed';
            messageEl.className = 'form-message error';
        }
    } catch (error) {
        messageEl.textContent = 'Error: Is the server running?';
        messageEl.className = 'form-message error';
        console.error('Scrape error:', error);
    } finally {
        if (btn) btn.disabled = false;
    }
}

document.getElementById('scrape-btn').addEventListener('click', runScrapeFromUrl);

// Auto-trigger scrape shortly after URL input changes
const scrapeUrlInput = document.getElementById('scrape-url');
let scrapeDebounce;
scrapeUrlInput.addEventListener('input', () => {
    clearTimeout(scrapeDebounce);
    if (!scrapeUrlInput.value.trim()) return;
    scrapeDebounce = setTimeout(runScrapeFromUrl, 800);
});

// Bulk import (admin)
document.getElementById('bulk-import-btn').addEventListener('click', async () => {
    const textarea = document.getElementById('bulk-urls');
    const messageEl = document.getElementById('bulk-import-message');
    const btn = document.getElementById('bulk-import-btn');

    const lines = textarea.value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length === 0) {
        messageEl.textContent = 'Please paste at least one URL.';
        messageEl.className = 'form-message error';
        return;
    }

    messageEl.textContent = 'Importing cheeses...';
    messageEl.className = 'form-message';
    btn.disabled = true;

    try {
        const response = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: lines }),
        });
        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = `Imported: ${data.imported}, Failed: ${data.failed}, Skipped: ${data.skipped}.`;
            messageEl.className = 'form-message success';
        } else {
            messageEl.textContent = data.message || data.error || 'Bulk import failed';
            messageEl.className = 'form-message error';
        }
    } catch (error) {
        console.error('Bulk import error:', error);
        messageEl.textContent = 'Error: Is the server running?';
        messageEl.className = 'form-message error';
    } finally {
        btn.disabled = false;
    }
});

// Add cheese form handler
document.getElementById('add-cheese-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const messageEl = document.getElementById('form-message');
    messageEl.textContent = '';

    const cheeseData = {
        name: form.name.value.trim(),
        origin: form.origin.value.trim(),
        milk: form.milk.value.trim(),
        description: form.description.value.trim() || undefined
    };

    try {
        const response = await fetch('/api/cheeses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cheeseData)
        });
        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = `${cheeseData.name} added successfully!`;
            messageEl.className = 'form-message success';
            form.reset();
            // Switch to Archive and refresh the cheese list
            document.getElementById('tab-archive').click();
            document.getElementById('fetch-btn').click();
        } else {
            messageEl.textContent = data.message || data.error || 'Failed to add cheese';
            messageEl.className = 'form-message error';
        }
    } catch (error) {
        messageEl.textContent = 'Error: Is the server running?';
        messageEl.className = 'form-message error';
        console.error('Add cheese error:', error);
    }
});

document.getElementById('fetch-btn').addEventListener('click', async () => {
    const container = document.getElementById('cheese-container');
    container.innerHTML = 'Loading...';

    try {
        // This calls the GET route you just tested in Thunder Client!
        const response = await fetch('/api/cheeses');
        const cheeses = await response.json();

        container.innerHTML = ''; // Clear the loading text

        cheeses.forEach(cheese => {
            const card = document.createElement('div');
            card.className = 'cheese-card';
        // Inside your cheeses.forEach(cheese => { ... })
        card.innerHTML = `
            <h3>${cheese.name}</h3>
            <p><strong>Origin:</strong> ${cheese.origin}</p>
            <p><strong>Milk:</strong> ${cheese.milk}</p>
            <p>${cheese.description || 'No description available.'}</p>
            <button class="delete-btn" onclick="deleteCheese('${cheese._id}')">Delete 🗑️</button>
        `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<p>Error loading cheeses. Is the server running?</p>';
        console.error('Fetch error:', error);
    }
});

async function deleteCheese(id) {
    if (!confirm('Are you sure you want to delete this cheese?')) return;

    try {
        const response = await fetch(`/api/cheeses/delete/${id}`, { method: 'POST' });
        if (response.ok) {
            // Refresh the list automatically after deleting
            document.getElementById('fetch-btn').click();
        } else {
            alert('Failed to delete cheese');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}