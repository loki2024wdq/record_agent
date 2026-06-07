const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.log(JSON.stringify({
    skipped: true,
    reason: "Playwright is not fully available in this runtime.",
    detail: error.message
  }, null, 2));
  process.exit(0);
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const appUrl = pathToFileURL(path.join(root, "app", "index.html")).href;
  const artifactsDir = path.join(root, "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(appUrl);
  await page.evaluate(() => localStorage.removeItem("record-agent-state-v1"));
  await page.reload();
  await page.waitForSelector(".memory-card");

  const initialTitle = await page.locator("#activeTripTitle").textContent();
  const initialCards = await page.locator(".memory-card").count();

  await page.fill("#memoryTitleInput", "车站前的风");
  await page.fill("#memoryLocationInput", "镰仓，高校前站");
  await page.fill("#memoryNoteInput", "列车过去以后，海风和站台声音混在一起，像是旅行突然慢了下来。");
  await page.fill("#memoryTagsInput", "车站, 海边, 声音");
  await page.click("#memoryForm button[type='submit']");
  await page.waitForFunction(() => document.querySelectorAll(".memory-card").length >= 2);

  await page.click("[data-action='generate-3d']");
  await page.waitForSelector(".depth-stage", { timeout: 5000 });

  await page.fill("#annotationInput", "列车经过后的安静");
  await page.click("[data-action='add-annotation']");
  await page.waitForSelector(".annotation-pin");

  await page.click("[data-view='map']");
  await page.waitForSelector(".map-marker");
  await page.click("[data-view='objects']");
  await page.waitForSelector(".object-card");
  await page.click("[data-view='review']");
  await page.waitForSelector(".review-block");

  const screenshotPath = path.join(artifactsDir, "app-preview.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const finalCards = await page.locator(".memory-card").count().catch(() => 0);
  await browser.close();

  if (errors.length) {
    throw new Error(`Browser errors:\n${errors.join("\n")}`);
  }

  console.log(JSON.stringify({
    appUrl,
    initialTitle,
    initialCards,
    finalCards,
    screenshotPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
