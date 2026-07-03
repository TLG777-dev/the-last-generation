const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  page.on('console', msg => { if (msg.type() === 'error') console.log('  ERR:', msg.text()); });
  await page.goto('http://localhost:5173/sign-of-jonah.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const skipBtn = await page.$('#tour-skip');
  if (skipBtn) { await skipBtn.click(); await page.waitForTimeout(1500); }
  await page.screenshot({ path: '/tmp/virgo-current.png' });
  console.log('Done');
  await browser.close();
})();
