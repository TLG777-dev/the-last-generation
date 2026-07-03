const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:5173/sign-of-jonah.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Log the current URL to check for redirects
  console.log('Current URL:', page.url());
  
  // Check page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check if the canvas exists (Three.js)
  const canvas = await page.$('canvas');
  console.log('Canvas found:', !!canvas);
  
  await page.screenshot({ path: '/tmp/soj-debug.png' });
  console.log('Screenshot saved to /tmp/soj-debug.png');
  
  if (errors.length > 0) {
    console.log('Console errors:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('No console errors');
  }
  
  await browser.close();
})();
