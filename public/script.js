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
            card.innerHTML = `
                <h3>${cheese.name}</h3>
                <p><strong>Origin:</strong> ${cheese.origin}</p>
                <p><strong>Milk:</strong> ${cheese.milk}</p>
                <p>${cheese.description || 'No description available.'}</p>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<p>Error loading cheeses. Is the server running?</p>';
        console.error('Fetch error:', error);
    }
});