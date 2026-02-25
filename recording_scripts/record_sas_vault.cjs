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

    // Part 1: SAS Version Control
    const sasPath = 'file://' + path.resolve(__dirname, '../public/mocks/sas_version_control_mock.html');
    await page.goto(sasPath);
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(2000);

    // Part 2: Veeva Vault
    const vaultPath = 'file://' + path.resolve(__dirname, '../public/mocks/veeva_vault_figures_mock.html');
    await page.goto(vaultPath);
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(3000);

    await context.close();

    // Rename video
    const video = await page.video();
    if (video) {
        const videoPath = await video.path();
        const targetPath = path.join(videoDir, 'dir_003_version_control_audit.webm');
        fs.renameSync(videoPath, targetPath);
        console.log(`Saved video to ${targetPath}`);
    }

    await browser.close();
})();
