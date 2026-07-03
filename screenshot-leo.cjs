const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:5173/sign-of-jonah.html');
  await page.waitForLoadState('networkidle');
  
  // Wait for tour to start then skip it
  await page.waitForTimeout(2000);
  const skipBtn = await page.$('#tour-skip');
  if (skipBtn) {
    await skipBtn.click();
    await page.waitForTimeout(1500);
  }
  
  await page.screenshot({ path: '/tmp/sign-of-jonah-leo.png' });
  console.log('Screenshot saved to /tmp/sign-of-jonah-leo.png');
  
  if (errors.length > 0) {
    console.log('Console errors:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('No console errors');
  }
  
  await browser.close();
})();
