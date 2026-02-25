const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const videoDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        recordVideo: {
            dir: videoDir,
            size: { width: 1280, height: 720 }
        }
    });

    const page = await context.newPage();
    const mockPath = 'file://' + path.resolve(__dirname, '../public/mocks/benchling_eln_mock.html');

    await page.goto(mockPath);
    await page.waitForTimeout(2000);

    // Scroll a bit
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1000);

    // Focus search
    await page.click('.search-input');
    await page.waitForTimeout(1000);

    // Click search
    await page.click('.search-btn');
    await page.waitForTimeout(2000);

    // Scroll to value
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(3000);

    await context.close();

    // Rename video
    const video = await page.video();
    if (video) {
        const videoPath = await video.path();
        const targetPath = path.join(videoDir, 'dir_002_benchling_eln_search.webm');
        fs.renameSync(videoPath, targetPath);
        console.log(`Saved video to ${targetPath}`);
    }

    await browser.close();
})();
