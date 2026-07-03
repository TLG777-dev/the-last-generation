const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  page.on('console', msg => { if (msg.type() === 'error') console.log('  ERR:', msg.text()); });
  await page.goto('http://localhost:5173/sign-of-jonah.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  // Skip tour
  const skipBtn = await page.$('#tour-skip');
  if (skipBtn) { await skipBtn.click(); await page.waitForTimeout(1000); }
  // Click reset button to go to default Virgo view
  const resetBtn = await page.$('#btn-reset');
  if (resetBtn) { await resetBtn.click(); await page.waitForTimeout(2000); }
  await page.screenshot({ path: '/tmp/virgo-view.png' });
  console.log('Done');
  await browser.close();
})();
