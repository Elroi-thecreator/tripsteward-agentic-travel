import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUT_DIR = path.resolve(process.cwd(), "assets", "screenshots");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function captureScreenshots() {
  console.log("📸 Starting screenshot capture pipeline...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/snap/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 1.5
  });
  const page = await context.newPage();

  // 1. Hub Overview
  console.log("Capturing 1: Hub Overview");
  await page.goto("http://127.0.0.1:8880/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "step1_hub_overview.png") });

  // 2. Edit Journey Modal
  console.log("Capturing 2: Edit Journey Modal");
  await page.click("#edit-journey-btn");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "step2_edit_journey.png") });
  await page.click("#close-journey-modal-btn");
  await page.waitForTimeout(300);

  // 3. Discover Specialist Agents Modal
  console.log("Capturing 3: Discover Agents Directory");
  await page.click("#open-discover-agents-btn");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "step3_discover_agents.png") });

  // Mount an agent and close modal
  const mountBtns = await page.$$(".btn-mount-agent");
  if (mountBtns.length > 0) {
    await mountBtns[0].click();
    await page.waitForTimeout(400);
  }
  await page.click("#close-discover-modal-btn");
  await page.waitForTimeout(300);

  // 4. Direct Bookings Confirmed
  console.log("Capturing 4: Direct Bookings State");
  await page.click("#book-hotel-manual-btn");
  await page.waitForTimeout(400);
  await page.click("#book-transfer-manual-btn");
  await page.waitForTimeout(400);
  await page.click("#book-exp-manual-btn");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "step4_direct_bookings.png") });

  // 5. Cryptographic Inspector & WebCrypto Verification
  console.log("Capturing 5: Cryptographic Inspector");
  await page.click("#toggle-inspector-btn");
  await page.waitForTimeout(400);
  await page.click("#verify-signatures-btn");
  await page.waitForTimeout(600);
  // Scroll down slightly to make drawer prominent
  await page.evaluate(() => {
    document.querySelector("#inspector-drawer")?.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.screenshot({ path: path.join(OUT_DIR, "step5_crypto_inspector.png") });

  // 6. Master Travel Pass & Export
  console.log("Capturing 6: Master Pass");
  await page.evaluate(() => {
    document.querySelector(".master-pass-card")?.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "step6_master_pass_export.png") });

  // 7. CityGlide Node (Port 8881)
  console.log("Capturing 7: CityGlide Autonomous Fleet Node");
  await page.goto("http://127.0.0.1:8881/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.click("#calc-quote-btn");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "step7_cityglide_node.png") });

  // 8. MetroPass Experiences Node (Port 8882)
  console.log("Capturing 8: MetroPass Experiences Node");
  await page.goto("http://127.0.0.1:8882/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "step8_metropass_node.png") });

  await browser.close();
  console.log("🎉 All 8 screenshots captured successfully in assets/screenshots/!");
}

captureScreenshots().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
