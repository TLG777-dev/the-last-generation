const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.goto('http://localhost:5173/sign-of-jonah.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  
  // Skip tour via direct click
  await page.evaluate(() => {
    const overlay = document.getElementById('tour-overlay');
    if (overlay) overlay.classList.add('hidden');
    const dots = document.getElementById('tour-dots');
    if (dots) dots.classList.remove('visible');
    const skip = document.getElementById('tour-skip');
    if (skip) skip.classList.remove('visible');
  });
  await page.waitForTimeout(500);

  // Enable controls and reset view to Virgo
  await page.evaluate(() => {
    // Find the reset button and click it
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.click();
  });
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: '/tmp/virgo-final.png' });
  console.log('Done');
  await browser.close();
})();
