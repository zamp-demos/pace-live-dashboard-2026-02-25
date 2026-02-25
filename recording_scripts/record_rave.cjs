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
    const mockPath = 'file://' + path.resolve(__dirname, '../public/mocks/medidata_rave_mock.html');

    await page.goto(mockPath);
    await page.waitForTimeout(2000);

    // Story 1: Enrollment data
    console.log("Showing Enrollment...");
    await page.click('button:has-text("Enrollment")');
    await page.waitForTimeout(2000);

    // Story 2: AE data
    console.log("Showing Adverse Events...");
    await page.click('button:has-text("Adverse Events")');
    await page.waitForTimeout(3000); // Give it time to render

    // Try to click the specific visible button
    console.log("Clicking Export...");
    await page.click('#adverse-events .export-btn');
    await page.waitForTimeout(2000);

    await context.close();

    // Rename video
    const video = await page.video();
    if (video) {
        const videoPath = await video.path();
        const targetPath = path.join(videoDir, 'dir_001_medidata_rave_extraction.webm');
        fs.renameSync(videoPath, targetPath);
        console.log(`Saved video to ${targetPath}`);
    }

    await browser.close();
})();
