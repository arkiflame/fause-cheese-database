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