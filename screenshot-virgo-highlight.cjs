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
  
  // Three views to capture the full Virgo body
  const views = [
    { az: 202, el: -30, name: 'low' },
    { az: 202, el: -35, name: 'lower' },
    { az: 205, el: -32, name: 'right' },
  ];
  
  for (const v of views) {
    await page.evaluate(({az, el}) => {
      window.__soj.azimuth = az;
      window.__soj.elevation = el;
    }, v);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/tmp/soj-74vir-${v.name}.png` });
    console.log(`Saved ${v.name}`);
  }
  
  if (errors.length > 0) {
    console.log('Console errors:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('No console errors');
  }
  
  await browser.close();
})();
