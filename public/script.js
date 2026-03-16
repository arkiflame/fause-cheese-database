// Global Auth State
let authToken = localStorage.getItem('token');
let currentUsername = localStorage.getItem('username');

function getAuthHeaders() {
    return authToken ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    } : {
        'Content-Type': 'application/json'
    };
}

function updateAuthUI() {
    const greeting = document.getElementById('user-greeting');
    const authForms = document.getElementById('auth-forms');
    const authUserMenu = document.getElementById('auth-user-menu');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const adminSections = document.querySelectorAll('.admin-only');
    
    // For MVP, anyone logged in sees admin tools.
    if (authToken && currentUsername) {
        greeting.textContent = `Hello, ${currentUsername}`;
        authForms.hidden = true;
        authUserMenu.hidden = false;
        authToggleBtn.textContent = 'Account ▾';
        
        adminSections.forEach(s => s.hidden = false);
        const tabLists = document.getElementById('tab-lists');
        const tabAdd = document.getElementById('tab-add');
        if (tabLists) tabLists.hidden = false;
        if (tabAdd) tabAdd.hidden = false;
        loadUserLists(); // load select dropdown
    } else {
        greeting.textContent = '';
        authForms.hidden = false;
        authUserMenu.hidden = true;
        authToggleBtn.textContent = 'Login / Register ▾';
        
        adminSections.forEach(s => s.hidden = true);
        const tabLists = document.getElementById('tab-lists');
        const tabAdd = document.getElementById('tab-add');
        if (tabLists) tabLists.hidden = true;
        if (tabAdd) tabAdd.hidden = true;
    }
}

// Dropdown Toggle
document.getElementById('auth-toggle-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('auth-dropdown-menu').classList.toggle('show');
});

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
    const container = document.querySelector('.auth-dropdown-container');
    if (container && !container.contains(e.target)) {
        document.getElementById('auth-dropdown-menu').classList.remove('show');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    authToken = null;
    currentUsername = null;
    updateAuthUI();
    document.getElementById('tab-archive').click();
    document.getElementById('auth-dropdown-menu').classList.remove('show');
});

// Run once on load
updateAuthUI();

// Auth form handlers
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('login-message');
    msg.textContent = 'Logging in...';
    msg.className = 'form-message';
    
    const username = e.target['login-username'].value.trim();
    const password = e.target['login-password'].value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            msg.textContent = 'Success!';
            msg.className = 'form-message success';
            authToken = data.token;
            currentUsername = data.username;
            localStorage.setItem('token', authToken);
            localStorage.setItem('username', currentUsername);
            e.target.reset();
            updateAuthUI();
            document.getElementById('tab-archive').click();
            document.getElementById('auth-dropdown-menu').classList.remove('show');
        } else {
            msg.textContent = data.message || 'Login failed';
            msg.className = 'form-message error';
        }
    } catch (err) {
        msg.textContent = 'Error logging in';
        msg.className = 'form-message error';
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('register-message');
    msg.textContent = 'Registering...';
    msg.className = 'form-message';
    
    const username = e.target['register-username'].value.trim();
    const password = e.target['register-password'].value;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            msg.textContent = 'Registered successfully! You can now log in above.';
            msg.className = 'form-message success';
            e.target.reset();
        } else {
            msg.textContent = data.message || 'Registration failed';
            msg.className = 'form-message error';
        }
    } catch (err) {
        msg.textContent = 'Error registering';
        msg.className = 'form-message error';
    }
});

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
        
        if (tab.id === 'tab-lists' && authToken) {
            fetchListsPage();
        }
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
            headers: getAuthHeaders(),
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
            headers: getAuthHeaders(),
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

// CSV import (admin)
function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[j] || '';
        }
        if (obj.name) {
            data.push(obj);
        }
    }
    return data;
}

document.getElementById('csv-import-btn').addEventListener('click', async () => {
    const textarea = document.getElementById('csv-data');
    const messageEl = document.getElementById('csv-import-message');
    const btn = document.getElementById('csv-import-btn');

    const cheeses = parseCSV(textarea.value);

    if (cheeses.length === 0) {
        messageEl.textContent = 'Please paste valid CSV data with headers (Name min required).';
        messageEl.className = 'form-message error';
        return;
    }

    messageEl.textContent = 'Importing CSV...';
    messageEl.className = 'form-message';
    btn.disabled = true;

    try {
        const response = await fetch('/api/import/csv', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ cheeses }),
        });
        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = `Imported: ${data.imported}, Failed: ${data.failed}, Skipped: ${data.skipped}.`;
            messageEl.className = 'form-message success';
            textarea.value = '';
            
            // Auto refresh
            if (data.imported > 0) {
              document.getElementById('fetch-btn').click();
            }
        } else {
            messageEl.textContent = data.message || data.error || 'CSV import failed';
            messageEl.className = 'form-message error';
        }
    } catch (error) {
        console.error('CSV import error:', error);
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
            headers: getAuthHeaders(),
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
        // Pass auth headers so the server can attach user-specific ratings if logged in
        const response = await fetch('/api/cheeses', { headers: getAuthHeaders() });
        let cheeses = await response.json();
        
        // Sort cheeses alphabetically
        cheeses.sort((a, b) => a.name.localeCompare(b.name));
        
        // Filter by search term
        const searchTerm = document.getElementById('cheese-search')?.value.toLowerCase() || '';
        if (searchTerm) {
            cheeses = cheeses.filter(c => 
                c.name.toLowerCase().includes(searchTerm)
            );
        }

        container.innerHTML = ''; // Clear the loading text

        cheeses.forEach(cheese => {
            // Only show verified cheeses to public; Admins see all.
            if (!authToken && cheese.status !== 'verified') {
               return; // Skip rendering
            }

            const card = document.createElement('div');
            card.className = 'cheese-card';
            if (cheese.status === 'pending_verification') {
               card.style.border = '2px dashed #f39c12';
            } else if (cheese.status === 'rejected') {
               card.style.border = '2px dashed #ff4d4d';
            }
            
            // Format average rating
            const avg = cheese.avgRating ? cheese.avgRating.toFixed(1) : 'No ratings';
            const total = cheese.totalRatings || 0;
            
            // Generate interactive stars
            let starsHtml = '<div class="stars-container" data-id="' + cheese._id + '">';
            for (let i = 1; i <= 5; i++) {
                let starClass = 'star';
                if (cheese.userRating && i <= cheese.userRating) {
                    starClass += ' rated';
                }
                starsHtml += `<span class="${starClass}" data-value="${i}">&#9733;</span>`;
            }
            starsHtml += `</div> <span class="rating-text">(${avg} - ${total} votes)</span>`;
            
            let listOptionsHtml = '<option value="">-- Select a List --</option>';
            if (window.userListsData) {
                window.userListsData.forEach(l => {
                    listOptionsHtml += `<option value="${l._id}">${l.name}</option>`;
                });
            }
            
            const listHtml = authToken ? `
                <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                   <select class="cheese-card-list-select" style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--bg-input); color:var(--text);">
                       ${listOptionsHtml}
                   </select>
                   <button class="add-to-list-btn" onclick="addCheeseToSelectedList(this, '${cheese._id}')" style="padding: 4px 12px; font-weight: bold; background-color: var(--primary);">Add</button>
                </div>
            ` : '';

            card.innerHTML = `
                <h3>${cheese.name}</h3>
                <p><strong>Origin:</strong> ${cheese.origin}</p>
                <p><strong>Milk:</strong> ${cheese.milk}</p>
                <p>${cheese.description || 'No description available.'}</p>
                ${authToken ? `<p><strong>Status:</strong> ${cheese.status}</p>` : ''}
                <div class="rating-section">${starsHtml}</div>
                ${listHtml}
                <div class="card-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                    <button class="delete-btn admin-only" onclick="deleteCheese('${cheese._id}')" ${authToken ? '' : 'hidden'}>Delete 🗑️</button>
                </div>
            `;
            container.appendChild(card);
        });
        
        // Add event listeners for stars
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async (e) => {
                if (!authToken) {
                    alert('You must be logged in to rate cheeses.');
                    return;
                }
                const value = parseInt(e.target.dataset.value);
                const cheeseId = e.target.closest('.stars-container').dataset.id;
                await submitRating(cheeseId, value);
            });
            
            // Optional hover effect
            star.addEventListener('mouseenter', (e) => {
                const value = parseInt(e.target.dataset.value);
                const siblings = Array.from(e.target.parentElement.children);
                siblings.forEach((s, idx) => {
                    if (idx < value) {
                        s.classList.add('hovered');
                    } else {
                        s.classList.remove('hovered');
                    }
                });
            });
            star.addEventListener('mouseleave', (e) => {
                const siblings = Array.from(e.target.parentElement.children);
                siblings.forEach(s => s.classList.remove('hovered'));
            });
        });
    } catch (error) {
        container.innerHTML = '<p>Error loading cheeses. Is the server running?</p>';
        console.error('Fetch error:', error);
    }
});

// Real-time search filter
document.getElementById('cheese-search')?.addEventListener('input', () => {
    document.getElementById('fetch-btn').click();
});

async function submitRating(cheeseId, score) {
    try {
        const response = await fetch(`/api/cheeses/${cheeseId}/rate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ score })
        });
        
        if (response.ok) {
            // Refresh to show updated average
            document.getElementById('fetch-btn').click();
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to submit rating');
        }
    } catch (error) {
        console.error('Rating error:', error);
    }
}

async function deleteCheese(id) {
    if (!confirm('Are you sure you want to delete this cheese?')) return;

    try {
        const response = await fetch(`/api/cheeses/delete/${id}`, { 
            method: 'POST',
            headers: getAuthHeaders()
        });
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

// Clear all cheeses
document.getElementById('clear-all-btn').addEventListener('click', async () => {
    if (!confirm('WARNING: Are you sure you want to delete ALL cheeses? This cannot be undone.')) return;

    try {
        const response = await fetch('/api/cheeses/clear', { 
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            document.getElementById('fetch-btn').click();
        } else {
            alert('Failed to clear cheeses');
        }
    } catch (error) {
        console.error('Error clearing cheeses:', error);
        alert('Error: Is the server running?');
    }
});



// --- LISTS MANAGEMENT ---

async function loadUserLists() {
    try {
        const response = await fetch('/api/lists', { headers: getAuthHeaders() });
        if (!response.ok) return;
        const lists = await response.json();
        window.userListsData = lists; // Store globally for cheese cards
    } catch (e) {
        console.error('Failed to load lists', e);
    }
}

async function fetchListsPage() {
    const container = document.getElementById('lists-container');
    container.innerHTML = 'Loading...';
    try {
        const response = await fetch('/api/lists', { headers: getAuthHeaders() });
        const lists = await response.json();
        
        if (lists.length === 0) {
            container.innerHTML = '<p>You have no lists yet.</p>';
            return;
        }
        
        container.innerHTML = '';
        lists.forEach(l => {
            const div = document.createElement('div');
            div.className = 'cheese-card'; // re-use styling
            div.innerHTML = `
                <h3>${l.name} <button class="delete-btn" onclick="deleteList('${l._id}')" style="float:right">Delete List</button></h3>
                <p>${l.cheeses.length} cheeses</p>
                <ul>
                    ${l.cheeses.map(c => `
                        <li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border);">
                            <span>${c.name} - ${c.origin}</span>
                            <button onclick="removeCheeseFromList('${l._id}', '${c._id}')" class="delete-btn" style="padding:2px 8px; font-size:12px; margin-left:15px;">Remove</button>
                        </li>
                    `).join('')}
                </ul>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        container.innerHTML = '<p>Failed to load lists.</p>';
    }
}

document.getElementById('create-list-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-list-name').value.trim();
    if (!name) return;
    
    try {
        const response = await fetch('/api/lists', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            document.getElementById('new-list-name').value = '';
            fetchListsPage();
            loadUserLists();
        } else {
            alert('Failed to create list');
        }
    } catch (e) {}
});

async function deleteList(id) {
    if (!confirm('Delete this list?')) return;
    try {
        await fetch(`/api/lists/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchListsPage();
        loadUserLists();
    } catch (e) {}
}

async function addCheeseToSelectedList(btnElem, cheeseId) {
    const listId = btnElem.previousElementSibling.value;
    if (!listId) {
        alert('Please select a list from the dropdown first.');
        return;
    }
    
    try {
        const response = await fetch(`/api/lists/${listId}/add/${cheeseId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            alert('Cheese added to list!');
            loadUserLists(); // refresh internal lists data
        } else {
            alert(data.message || 'Failed to add to list');
        }
    } catch (e) {
        console.error('Add list error:', e);
    }
}

async function removeCheeseFromList(listId, cheeseId) {
    if (!confirm('Remove this cheese from the list?')) return;
    try {
        const response = await fetch(`/api/lists/${listId}/remove/${cheeseId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            fetchListsPage(); // Re-render the list view
            loadUserLists();  // Keep the internal state synced
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to remove from list');
        }
    } catch (e) {
        console.error('Remove list error:', e);
    }
}