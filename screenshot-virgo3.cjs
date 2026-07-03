const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.goto('http://localhost:5173/sign-of-jonah.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  // Skip tour
  const skipBtn = await page.$('#tour-skip');
  if (skipBtn) { await skipBtn.click(); await page.waitForTimeout(500); }
  // Use page evaluate to set camera to Virgo region
  await page.evaluate(() => {
    // Access Three.js internals through window
    const canvas = document.getElementById('canvas');
    if (canvas && canvas.__three) {
      console.log('Found three on canvas');
    }
  });
  await page.waitForTimeout(500);
  // Use arrow keys to pan left toward Virgo (higher RA)
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/virgo-pan.png' });
  console.log('Done');
  await browser.close();
})();
