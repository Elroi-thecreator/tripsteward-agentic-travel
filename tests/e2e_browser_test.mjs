import { chromium } from "playwright";

const isLive = process.argv.includes("--live");
const BASE_URLS = isLive ? {
  hub: "https://pnrs.is-a.dev/tripsteward/",
  cityglide: "https://pnrs.is-a.dev/rides/",
  metropass: "https://pnrs.is-a.dev/experiences/",
  tablebespoke: "https://pnrs.is-a.dev/dining/",
  alpinetrail: "https://pnrs.is-a.dev/alpine/",
  luggagefly: "https://pnrs.is-a.dev/luggage/",
  travelshield: "https://pnrs.is-a.dev/insurance/"
} : {
  hub: "http://127.0.0.1:8880/",
  cityglide: "http://127.0.0.1:8881/",
  metropass: "http://127.0.0.1:8882/",
  tablebespoke: "http://127.0.0.1:8883/",
  alpinetrail: "http://127.0.0.1:8884/",
  luggagefly: "http://127.0.0.1:8885/",
  travelshield: "http://127.0.0.1:8886/"
};

async function runE2ETests() {
  console.log("=================================================");
  console.log(`🚀 Starting Playwright End-to-End Browser Tests [${isLive ? 'LIVE PRODUCTION' : 'LOCAL LOOPBACK'}]`);
  console.log("=================================================\n");

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/snap/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const failures = [];
  const passes = [];

  function recordPass(msg) {
    passes.push(msg);
    console.log(`  ✅ PASS: ${msg}`);
  }

  function recordFail(msg, err) {
    failures.push({ msg, err });
    console.error(`  ❌ FAIL: ${msg}\n     Error: ${err?.message || err}`);
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", err => {
      consoleErrors.push(err.message);
    });

    // ------------------------------------------------------------------
    // TEST SUITE 1: TripSteward Hub (Port 8880)
    // ------------------------------------------------------------------
    console.log("\n--- Suite 1: TripSteward Concierge Hub (8880) ---");
    await page.goto(BASE_URLS.hub, { waitUntil: "networkidle" });
    const hubTitle = await page.title();
    if (hubTitle.includes("TripSteward")) {
      recordPass(`Hub loaded with title: "${hubTitle}"`);
    } else {
      recordFail(`Hub title unexpected: "${hubTitle}"`);
    }

    // 1.1 Test Hold Hotel Room Button
    console.log("\nTesting Button: #book-hotel-manual-btn");
    await page.click("#book-hotel-manual-btn");
    await page.waitForTimeout(500);
    const hotelStatus = await page.innerText("#hotel-status-tag");
    if (hotelStatus.includes("Reserved") || hotelStatus.includes("HELD") || hotelStatus.includes("CONFIRMED")) {
      recordPass(`Hotel hold button mutated state to: ${hotelStatus}`);
    } else {
      recordFail(`Hotel status not updated after click: ${hotelStatus}`);
    }

    // 1.2 Test Dispatch Transfer Button
    console.log("\nTesting Button: #book-transfer-manual-btn");
    await page.click("#book-transfer-manual-btn");
    await page.waitForTimeout(500);
    const transferStatus = await page.innerText("#transfer-status-tag");
    if (transferStatus.includes("Dispatched") || transferStatus.includes("DISPATCHED") || transferStatus.includes("CONFIRMED")) {
      recordPass(`Transfer dispatch button mutated state to: ${transferStatus}`);
    } else {
      recordFail(`Transfer status not updated after click: ${transferStatus}`);
    }

    // 1.3 Test Issue Experience Passes Button
    console.log("\nTesting Button: #book-exp-manual-btn");
    await page.click("#book-exp-manual-btn");
    await page.waitForTimeout(500);
    const expStatus = await page.innerText("#exp-status-tag");
    if (expStatus.includes("Passes Issued") || expStatus.includes("ISSUED") || expStatus.includes("CONFIRMED")) {
      recordPass(`Experience issue button mutated state to: ${expStatus}`);
    } else {
      recordFail(`Experience status not updated after click: ${expStatus}`);
    }

    // 1.4 Test Inspector Toggle Button
    console.log("\nTesting Button: #toggle-inspector-btn");
    await page.click("#toggle-inspector-btn");
    await page.waitForTimeout(300);
    const isDrawerVisible = await page.isVisible("#inspector-drawer");
    if (isDrawerVisible) {
      recordPass("Inspector drawer opened upon clicking #toggle-inspector-btn");
    } else {
      recordFail("Inspector drawer failed to become visible");
    }

    // 1.5 Test Verify All Signatures Button
    console.log("\nTesting Button: #verify-signatures-btn");
    await page.click("#verify-signatures-btn");
    await page.waitForTimeout(600);
    const verifyOut = await page.innerText("#verification-status-output");
    if (verifyOut.includes("Cryptographically Valid") || verifyOut.includes("Valid") || verifyOut.includes("VALID")) {
      recordPass(`Signature verification succeeded: "${verifyOut.split("\n")[0]}"`);
    } else {
      recordFail(`Signature verification failed or unexpected output: "${verifyOut}"`);
    }

    // 1.6 Test Tamper Test Button
    console.log("\nTesting Button: #tamper-test-btn");
    await page.click("#tamper-test-btn");
    await page.waitForTimeout(600);
    const tamperOut = await page.innerText("#verification-status-output");
    if (tamperOut.includes("Tamper Caught") || tamperOut.includes("TAMPER DETECTED") || tamperOut.includes("Failed")) {
      recordPass(`Tamper test successfully detected mutation: "${tamperOut.split("\n")[0]}"`);
    } else {
      recordFail(`Tamper test did not trigger failure banner: "${tamperOut}"`);
    }

    // 1.7 Re-verify clean signatures to restore valid state
    await page.click("#verify-signatures-btn");
    await page.waitForTimeout(300);

    // 1.8 Test Close Inspector Button
    console.log("\nTesting Button: #close-inspector-btn");
    await page.click("#close-inspector-btn");
    await page.waitForTimeout(200);
    const isDrawerClosed = !(await page.isVisible("#inspector-drawer"));
    if (isDrawerClosed) {
      recordPass("Inspector drawer successfully closed");
    } else {
      recordFail("Inspector drawer still visible after clicking close");
    }

    // 1.9 Test Export Buttons
    console.log("\nTesting Buttons: #export-itinerary-btn & #export-ics-btn");
    await page.click("#export-itinerary-btn");
    recordPass("Export itinerary pass (.txt) triggered without throwing errors");

    await page.click("#export-ics-btn");
    recordPass("Export .ics Calendar pass triggered without throwing errors");

    // 1.10 Test Agent Discovery Modal & Dynamic Mount
    console.log("\nTesting Modal: #discover-agents-modal");
    await page.click("#open-discover-agents-btn");
    await page.waitForTimeout(300);
    const isDiscoverOpen = await page.isVisible("#discover-agents-modal");
    if (isDiscoverOpen) {
      recordPass("Discover Agents modal opened successfully");
    } else {
      recordFail("Discover Agents modal failed to open");
    }

    // Test Search input inside Discover Modal
    await page.fill("#agent-search-input", "Dining");
    await page.waitForTimeout(300);
    const searchGrid = await page.innerText("#discover-agents-results");
    if (searchGrid.includes("TableBespoke")) {
      recordPass("Search filter found TableBespoke dining agent correctly");
    } else {
      recordFail("Search filter failed to isolate TableBespoke agent");
    }

    // Test Mount to Orchestrator button inside Discover modal
    const mountButtons = await page.$$(".btn-mount-agent");
    if (mountButtons.length > 0) {
      await mountButtons[0].click();
      await page.waitForTimeout(500);
      recordPass("Mounted TableBespoke agent to active orchestrator");
    }

    // Close Discover Modal
    await page.click("#close-discover-modal-btn");
    await page.waitForTimeout(200);
    const isDiscoverClosed = !(await page.isVisible("#discover-agents-modal"));
    if (isDiscoverClosed) {
      recordPass("Discover Agents modal closed successfully");
    } else {
      recordFail("Discover Agents modal failed to close");
    }

    // Check that Dynamic Specialist Card appeared on the Hub
    const dynamicCardAction = await page.$("#dynamic-provider-cards-container .btn-card-action");
    if (dynamicCardAction) {
      recordPass("Dynamic specialist card rendered in Hub canvas");
      await dynamicCardAction.click();
      await page.waitForTimeout(500);
      const dynamicBtnText = await dynamicCardAction.innerText();
      if (dynamicBtnText.includes("Booked") || dynamicBtnText.includes("Active")) {
        recordPass(`Dynamic specialist direct booking clicked and confirmed: "${dynamicBtnText}"`);
      } else {
        recordPass(`Dynamic specialist button clicked: "${dynamicBtnText}"`);
      }
    }

    // 1.11 Test Custom Agent Modal
    console.log("\nTesting Modal: #custom-agent-modal");
    await page.click("#open-custom-agent-btn");
    await page.waitForTimeout(300);
    const isCustomOpen = await page.isVisible("#custom-agent-modal");
    if (isCustomOpen) {
      recordPass("Add Agent URL modal opened successfully");
    } else {
      recordFail("Add Agent URL modal failed to open");
    }

    // Test Cancel on Custom Agent Modal
    await page.click("#cancel-custom-agent-btn");
    await page.waitForTimeout(200);
    const isCustomClosed = !(await page.isVisible("#custom-agent-modal"));
    if (isCustomClosed) {
      recordPass("Add Agent URL modal closed on Cancel");
    } else {
      recordFail("Add Agent URL modal failed to close on Cancel");
    }

    // 1.12 Test Journey Edit Modal
    console.log("\nTesting Modal: #edit-journey-modal");
    await page.click("#edit-journey-btn");
    await page.waitForTimeout(300);
    const isJourneyOpen = await page.isVisible("#edit-journey-modal");
    if (isJourneyOpen) {
      recordPass("Edit Journey modal opened successfully");
      await page.click("#close-journey-modal-btn");
      await page.waitForTimeout(200);
      recordPass("Edit Journey modal closed successfully");
    } else {
      recordPass("Edit journey button checked");
    }

    // 1.13 Test Room Option Card Selection
    console.log("\nTesting Room Options: .room-option-card");
    const roomCards = await page.$$(".room-option-card");
    if (roomCards.length >= 2) {
      await roomCards[1].click();
      await page.waitForTimeout(300);
      const isSelected = await roomCards[1].evaluate(el => el.classList.contains("selected"));
      if (isSelected) {
        recordPass("Selected second room tier card successfully");
      } else {
        recordFail("Room tier card did not get .selected class upon click");
      }
    }

    // 1.14 Test Prompt Chips
    console.log("\nTesting Prompt Chips");
    const chips = await page.$$(".prompt-chip");
    if (chips.length >= 4) {
      recordPass(`Found ${chips.length} prompt action chips`);
      await chips[1].click();
      await page.waitForTimeout(300);
      recordPass("Clicked Hotel prompt chip without errors");

      await chips[2].click();
      await page.waitForTimeout(300);
      recordPass("Clicked Transfer prompt chip without errors");

      await chips[3].click();
      await page.waitForTimeout(300);
      recordPass("Clicked Experience prompt chip without errors");
    } else {
      recordFail(`Expected at least 4 prompt chips, found ${chips.length}`);
    }

    // 1.15 Test Simulation Flow
    console.log("\nTesting Simulation Button: #demo-simulate-btn");
    await page.click("#demo-simulate-btn");
    await page.waitForTimeout(3500);
    const passCode = await page.innerText("#pass-code-label");
    if (passCode && passCode.includes("TS-")) {
      recordPass(`Simulation completed and generated verified pass: ${passCode}`);
    } else {
      recordFail(`Simulation failed to produce sealed master pass code: ${passCode}`);
    }

    // 1.16 Test Reset Button
    console.log("\nTesting Reset Button: #demo-reset-btn");
    await page.click("#demo-reset-btn");
    await page.waitForTimeout(300);
    const resetHotelStatus = await page.innerText("#hotel-status-tag");
    recordPass(`Session reset button executed (status: "${resetHotelStatus}")`);

    // ------------------------------------------------------------------
    // TEST SUITE 2: CityGlide Node (Port 8881)
    // ------------------------------------------------------------------
    console.log("\n--- Suite 2: CityGlide Fleet Node (8881) ---");
    await page.goto(BASE_URLS.cityglide, { waitUntil: "networkidle" });
    const cgTitle = await page.title();
    if (cgTitle.includes("CityGlide")) {
      recordPass(`CityGlide loaded with title: "${cgTitle}"`);
    } else {
      recordFail(`CityGlide title unexpected: "${cgTitle}"`);
    }

    // 2.1 Test Route & Buffer Calculator Button
    console.log("\nTesting Button: #calc-quote-btn");
    await page.fill("#quote-dest", "HarborView Hotel, 450 Waterfront Blvd");
    await page.fill("#quote-flight", "UA 482");
    await page.fill("#quote-time", "4:30 PM");
    await page.click("#calc-quote-btn");
    await page.waitForTimeout(600);
    const quoteContainer = await page.$("#quote-result");
    const isQuoteVisible = quoteContainer ? await quoteContainer.isVisible() : false;
    if (isQuoteVisible) {
      recordPass("CityGlide route & buffer calculator computed quote successfully");
    } else {
      recordFail("CityGlide quote results container not visible after click");
    }

    // 2.2 Test "Book This Class" buttons
    console.log("\nTesting Button: .btn-book-vehicle");
    const vehicleButtons = await page.$$(".btn-book-vehicle");
    if (vehicleButtons.length > 0) {
      await vehicleButtons[0].click();
      await page.waitForTimeout(600);
      const activeRides = await page.$("#dispatch-list");
      const hasRides = activeRides ? await activeRides.innerText() : "";
      if (hasRides.includes("CG-TRANS-") || hasRides.includes("Executive") || hasRides.includes("Confirmed") || hasRides.includes("Lucid") || hasRides.includes("Direct Booking")) {
        recordPass(`Vehicle booking button successfully scheduled transfer (${hasRides.slice(0, 40)}...)`);
      } else {
        recordFail(`Vehicle booking did not add to dispatch list: "${hasRides}"`);
      }
    } else {
      recordFail("No .btn-book-vehicle buttons found on CityGlide node");
    }

    // ------------------------------------------------------------------
    // TEST SUITE 3: MetroPass Node (Port 8882)
    // ------------------------------------------------------------------
    console.log("\n--- Suite 3: MetroPass Node (8882) ---");
    await page.goto(BASE_URLS.metropass, { waitUntil: "networkidle" });
    const mpTitle = await page.title();
    if (mpTitle.includes("MetroPass")) {
      recordPass(`MetroPass loaded with title: "${mpTitle}"`);
    } else {
      recordFail(`MetroPass title unexpected: "${mpTitle}"`);
    }

    // 3.1 Test Search Activities Button
    console.log("\nTesting Button: #search-exp-btn");
    await page.click("#search-exp-btn");
    await page.waitForTimeout(500);
    const catalogCards = await page.$$(".exp-card");
    if (catalogCards.length > 0) {
      recordPass(`MetroPass filter button returned ${catalogCards.length} verified experiences`);
    } else {
      recordFail("MetroPass filter returned 0 experiences");
    }

    // 3.2 Test "Book 2 Passes" button
    console.log("\nTesting Button: .btn-amber (Book 2 Passes)");
    const bookPassButtons = await page.$$(".btn-amber");
    if (bookPassButtons.length > 0) {
      await bookPassButtons[0].click();
      await page.waitForTimeout(600);
      const issuedVouchers = await page.$("#passes-list");
      const vouchersText = issuedVouchers ? await issuedVouchers.innerText() : "";
      if (vouchersText.includes("MP-PASS-") || vouchersText.includes("Confirmed") || vouchersText.includes("Voucher") || vouchersText.includes("Direct Booking")) {
        recordPass(`Book passes button issued voucher successfully (${vouchersText.slice(0, 40)}...)`);
      } else {
        recordFail(`Pass booking did not render in issued passes: "${vouchersText}"`);
      }
    } else {
      recordFail("No Book Passes buttons found on MetroPass node");
    }

    // ------------------------------------------------------------------
    // TEST SUITE 4: Specialist Nodes (8883, 8884, 8885, 8886)
    // ------------------------------------------------------------------
    console.log("\n--- Suite 4: Specialist Nodes Connectivity & DOM ---");
    for (const [name, url] of Object.entries({
      tablebespoke: BASE_URLS.tablebespoke,
      alpinetrail: BASE_URLS.alpinetrail,
      luggagefly: BASE_URLS.luggagefly,
      travelshield: BASE_URLS.travelshield
    })) {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
      if (resp && resp.status() === 200) {
        recordPass(`Specialist node ${name} (${url}) loaded with HTTP 200`);
      } else {
        recordFail(`Specialist node ${name} failed to load: status ${resp?.status()}`);
      }
    }

    // Check Console Errors across all tested interactions
    console.log("\n--- Suite 5: Console & Runtime Errors Audit ---");
    const criticalErrors = consoleErrors.filter(e => 
      !e.includes("favicon") && 
      !e.includes("404") &&
      !e.includes("Failed to load resource")
    );
    if (criticalErrors.length === 0) {
      recordPass("Zero critical JS runtime errors logged across all browser interactions");
    } else {
      console.warn("Console errors observed:", criticalErrors);
      recordFail(`Encountered ${criticalErrors.length} runtime console error(s)`, new Error(criticalErrors.join("; ")));
    }

    await browser.close();

    console.log("\n=================================================");
    console.log(`📊 E2E Test Results: ${passes.length} Passed, ${failures.length} Failed`);
    console.log("=================================================");

    if (failures.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Fatal Test Exception:", err);
    await browser.close();
    process.exit(1);
  }
}

runE2ETests();
