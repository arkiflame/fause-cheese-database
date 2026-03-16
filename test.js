const testAPI = async () => {
    try {
        console.log('Testing Registration...');
        const regRes = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testuser1', password: 'password123' })
        });
        const regData = await regRes.json();
        console.log('Registration Response:', regRes.status, regData);

        console.log('\nTesting Login...');
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testuser1', password: 'password123' })
        });
        const loginData = await loginRes.json();
        console.log('Login Response:', loginRes.status, loginData);
    } catch (e) {
        console.error(e);
    }
};

testAPI();
