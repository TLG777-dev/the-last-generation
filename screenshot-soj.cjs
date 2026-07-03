const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  
  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:5173/sign-of-jonah.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '/tmp/sign-of-jonah-check.png' });
  console.log('Screenshot saved to /tmp/sign-of-jonah-check.png');
  
  if (errors.length > 0) {
    console.log('Console errors:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('No console errors');
  }
  
  await browser.close();
})();
