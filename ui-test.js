const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');
    
    // 1. Register a test user
    console.log('Checking Auth Tabs...');
    await page.click('#tab-auth');
    await page.fill('#register-username', 'testuser99');
    await page.fill('#register-password', 'password123');
    await page.click('#register-form button');
    await page.waitForTimeout(1000);
    const regMsg = await page.textContent('#register-message');
    console.log('Registration message:', regMsg);

    // 2. Login
    console.log('Logging in...');
    await page.fill('#login-username', 'testuser99');
    await page.fill('#login-password', 'password123');
    await page.click('#login-form button');
    await page.waitForTimeout(1000);
    
    // 3. Verify Lists tab becomes visible
    const listsTabVisible = await page.isVisible('#tab-lists');
    console.log('Is Lists Tab Visible?', listsTabVisible);
    
    // 4. Create a List
    if (listsTabVisible) {
        console.log('Creating List...');
        await page.click('#tab-lists');
        await page.fill('#new-list-name', 'My Favorites');
        await page.click('#create-list-form button');
        await page.waitForTimeout(1000);
        
        const listHtml = await page.innerHTML('#lists-container');
        console.log('Lists Container HTML contains "My Favorites"?', listHtml.includes('My Favorites'));
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }
})();
