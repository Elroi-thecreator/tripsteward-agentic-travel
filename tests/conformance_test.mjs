// Automated Conformance Test Suite for TripSteward Open Agentic Web Cluster
// Validates manifests, declarative JSON networks, peer link mappings, and site-action schemas across all 3 nodes.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { verifyActionReceipt } from "../packages/open-agentic-web/src/actions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n========================================================");
console.log("✈️  Running TripSteward Open Agentic Web Conformance Test Suite");
console.log("========================================================\n");

// 1. Validate Manifests
console.log("1. Validating Agent Manifests (agent-manifest.json)...");
const siteDirs = ["tripsteward-hub", "cityglide-node", "metropass-node"];

for (const dir of siteDirs) {
  const manifestPath = join(rootDir, "sites", dir, "agent-manifest.json");
  assert(existsSync(manifestPath), `${dir} has agent-manifest.json`);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  assert(Array.isArray(manifest.networks) && manifest.networks.length > 0, `${dir} declares at least one network`);

  const net = manifest.networks[0];
  assert(typeof net.name === "string" && net.name.length > 0, `${dir} network has a valid name (${net.name})`);
  assert(typeof net.front_man === "string" && net.front_man.length > 0, `${dir} network declares front_man (${net.front_man})`);
  assert(typeof net.hocon === "string", `${dir} network points to hocon/json path (${net.hocon})`);

  assert(manifest.llm_router && manifest.llm_router.base_url, `${dir} declares llm_router with base_url`);
  assert(manifest.actions && Array.isArray(manifest.actions.agentTools), `${dir} declares registered agentTools`);
  assert(existsSync(join(rootDir, "sites", dir, "bridge", "action-bridge.html")), `${dir} contains bridge/action-bridge.html`);
}

// 2. Validate Network JSON Definitions
console.log("\n2. Validating Declarative Network JSON Graphs...");
const networkFiles = [
  { dir: "tripsteward-hub", file: "tripsteward_concierge.network.json", frontAgent: "travel_concierge" },
  { dir: "cityglide-node", file: "cityglide_transfer.network.json", frontAgent: "transfer_dispatcher" },
  { dir: "metropass-node", file: "metropass_experiences.network.json", frontAgent: "experience_curator" }
];

for (const item of networkFiles) {
  const netPath = join(rootDir, "sites", item.dir, item.file);
  assert(existsSync(netPath), `${item.dir} contains ${item.file}`);

  const net = JSON.parse(readFileSync(netPath, "utf-8"));
  assert(Array.isArray(net.tools) && net.tools.length > 0, `${item.file} contains tools array`);

  const agent = net.tools.find(t => t.name === item.frontAgent);
  assert(agent !== undefined, `${item.file} defines front agent '${item.frontAgent}'`);
  assert(agent && typeof agent.instructions === "string" && agent.instructions.length > 50, `${item.frontAgent} has non-trivial grounded instructions`);
  assert(agent && agent.function && agent.function.parameters, `${item.frontAgent} declares input schema parameters`);
}

// 3. Validate Links Map
console.log("\n3. Validating Peer Links Mapping (links.json)...");
const linksPath = join(rootDir, "sites", "tripsteward-hub", "links.json");
assert(existsSync(linksPath), "tripsteward-hub contains links.json");
const links = JSON.parse(readFileSync(linksPath, "utf-8"));
assert(links.networks && links.networks.tripsteward_concierge, "links.json configures tripsteward_concierge network");
assert(links.networks.tripsteward_concierge.cityglide && links.networks.tripsteward_concierge.metropass, "links.json maps both cityglide and metropass peers");

// 4. Test Site Actions (Tool Execution & Schemas)
console.log("\n4. Testing Site Actions & Grounded Booking Vaults...");

// Mock minimal DOM for script.js / site-actions.js in Node
globalThis.window = {
  location: { origin: "http://localhost:8080" }
};
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

async function testActions() {
  // Test CityGlide Node Actions
  const cityglideActionsUrl = pathToFileURL(join(rootDir, "sites", "cityglide-node", "site-actions.js")).href;
  const { SiteActions: CityGlideActions } = await import(cityglideActionsUrl);

  const quoteTool = CityGlideActions.quoteTransferServiceAction();
  const quoteResult = await quoteTool.execute({
    destination: "HarborView Hotel, 450 Waterfront Blvd",
    pickup_time: "4:30 PM",
    flight_number: "UA 482",
    passengers: 2
  });
  assert(quoteResult.options.length >= 2, "CityGlide quotes multiple vehicle classes");
  assert(quoteResult.calculated_pickup_time.includes("5:00 PM"), "CityGlide computes 30-min arrival buffer");
  assert(quoteResult.options[0].fare_usd === 68, "CityGlide Executive EV Sedan has verified $68 direct rate");

  const scheduleTool = CityGlideActions.scheduleAirportTransferAction();
  const scheduleResult = await scheduleTool.execute({
    vehicle_class: "Executive EV Sedan",
    passenger_name: "Dr. Rachel Chen",
    pickup_location: "SFO Terminal 2 Curbside",
    dropoff_location: "HarborView Hotel, 450 Waterfront Blvd",
    pickup_time: "5:00 PM",
    flight_number: "UA 482"
  });
  assert(scheduleResult.success === true, "CityGlide schedules airport transfer");
  assert(scheduleResult.transfer_id.startsWith("CG-TRANS-"), "CityGlide issues unique transfer ID");
  assert(scheduleResult.driver_assigned.length > 0, "CityGlide assigns professional driver");
  assert(scheduleResult.receipt && scheduleResult.receipt.algorithm === "ES256", "CityGlide issues signed ECDSA P-256 action receipt");
  const cgJwks = JSON.parse(readFileSync(join(rootDir, "sites", "cityglide-node", ".well-known", "jwks.json"), "utf-8"));
  const cgVerified = await verifyActionReceipt(scheduleResult.receipt, cgJwks.keys[0]);
  assert(cgVerified.valid === true, "CityGlide ECDSA receipt passes cryptographic WebCrypto verification");

  const fleetTool = CityGlideActions.getFleetStatusAction();
  const fleetResult = await fleetTool.execute({});
  assert(fleetResult.fleet_inventory.length >= 4, "CityGlide reports 4 active standby vehicles");

  // Test MetroPass Node Actions
  const metroActionsUrl = pathToFileURL(join(rootDir, "sites", "metropass-node", "site-actions.js")).href;
  const { SiteActions: MetroPassActions } = await import(metroActionsUrl);

  const searchTool = MetroPassActions.searchExperiencesAction();
  const searchResult = await searchTool.execute({ city: "San Francisco", category: "sailing" });
  assert(searchResult.matched_count >= 1, "MetroPass searches experiences by city & category");
  assert(searchResult.experiences[0].title.includes("Sunset Catamaran"), "MetroPass returns sunset catamaran sail");

  const bookPassTool = MetroPassActions.bookExperiencePassAction();
  const passResult = await bookPassTool.execute({
    experience_id: "EXP-SF-01",
    attendee_name: "Dr. Rachel Chen",
    tickets: 2
  });
  assert(passResult.success === true, "MetroPass issues experience pass voucher");
  assert(passResult.pass_code.startsWith("MP-PASS-"), "MetroPass generates scannable pass code");
  assert(passResult.total_price_usd === 158, "MetroPass calculates direct total price correctly ($79 x 2 = $158)");
  assert(passResult.receipt && passResult.receipt.algorithm === "ES256", "MetroPass issues signed ECDSA P-256 action receipt");
  const mpJwks = JSON.parse(readFileSync(join(rootDir, "sites", "metropass-node", ".well-known", "jwks.json"), "utf-8"));
  const mpVerified = await verifyActionReceipt(passResult.receipt, mpJwks.keys[0]);
  assert(mpVerified.valid === true, "MetroPass ECDSA receipt passes cryptographic WebCrypto verification");

  // Test TripSteward Hub Actions
  const hubActionsUrl = pathToFileURL(join(rootDir, "sites", "tripsteward-hub", "site-actions.js")).href;
  const { SiteActions: HubActions } = await import(hubActionsUrl);

  const getPrefTool = HubActions.getTripPreferencesAction();
  const pref = await getPrefTool.execute();
  assert(pref.destination.includes("San Francisco"), "TripSteward retrieves active traveler preferences");
  assert(pref.target_budget_usd > 0, `TripSteward gets traveler target budget ($${pref.target_budget_usd})`);

  const hotelTool = HubActions.reserveHotelRoomAction();
  const hotelRes = await hotelTool.execute({
    room_tier: "Deluxe Bay-View Queen",
    nightly_rate_usd: 189,
    nights: 2,
    guest_names: "Dr. Rachel Chen",
    amenities_included: ["Complimentary Artisan Breakfast", "High-Speed Wi-Fi", "Late Check-out 1 PM"]
  });
  assert(hotelRes.ok === true, "TripSteward holds hotel room reservation");
  assert(hotelRes.total_stay_cost === 378, "TripSteward computes room charges ($189 x 2 = $378)");
  assert(hotelRes.receipt && hotelRes.receipt.algorithm === "ES256", "HarborView issues signed ECDSA P-256 action receipt");
  const hvJwks = JSON.parse(readFileSync(join(rootDir, "sites", "tripsteward-hub", ".well-known", "jwks.json"), "utf-8"));
  const hvVerified = await verifyActionReceipt(hotelRes.receipt, hvJwks.keys[0]);
  assert(hvVerified.valid === true, "HarborView ECDSA receipt passes cryptographic WebCrypto verification");

  const bookTransferTool = HubActions.bookAirportTransferAction();
  const transRes = await bookTransferTool.execute({
    pickup_location: "SFO Terminal 2 - Flight UA 482",
    dropoff_location: "HarborView Hotel, 450 Waterfront Blvd",
    vehicle_class: "Executive EV Sedan",
    pickup_time: "5:00 PM (Flight buffer +30m)",
    fare_usd: 68
  });
  assert(transRes.ok === true, "TripSteward confirms partner airport transfer");
  assert(transRes.transfer_booking_id.startsWith("CG-TRANS-") || transRes.transfer_booking_id.startsWith("RIDE-"), "TripSteward registers ride booking reference ID");

  const bookExpTool = HubActions.bookCityExperienceAction();
  const expRes = await bookExpTool.execute({
    experience_name: "Golden Gate Sunset Catamaran Cruise",
    scheduled_slot: "Saturday, 6:00 PM - 8:00 PM",
    tickets_count: 2,
    total_price_usd: 158,
    special_notes: "Boarding at Pier 39, Marina Gate B"
  });
  assert(expRes.ok === true, "TripSteward confirms partner experience tickets");
  assert(expRes.experience_pass_id.startsWith("MP-PASS-") || expRes.experience_pass_id.startsWith("PASS-"), "TripSteward registers experience voucher reference ID");

  const masterTool = HubActions.compileMasterItineraryAction();
  const masterRes = await masterTool.execute({
    trip_title: "San Francisco Waterfront & Sunset Getaway",
    destination: "San Francisco, CA",
    dates: "Nov 27 - Nov 29, 2026",
    total_cost_usd: 604,
    direct_savings_usd: 161,
    itinerary_highlights: [
      "HarborView Hotel: Deluxe Bay-View Queen (2 nights)",
      "CityGlide Transfer: Executive EV Sedan from SFO",
      "MetroPass Experience: Golden Gate Sunset Catamaran Cruise (2 passes)"
    ],
    concierge_notes: "Curbside chauffeur will meet flight UA 482 at 5:00 PM. Sunset sail departs Saturday 6 PM from Pier 39."
  });
  assert(masterRes.ok === true && masterRes.status === "COMMITTED_TO_CLIENT_SESSION", "TripSteward compiles and seals master itinerary");
  assert(masterRes.itinerary_id.startsWith("TS-ITIN-") || masterRes.itinerary_id.startsWith("ITIN-"), "TripSteward generates sealed itinerary ID");

  // Dynamic Agent Discovery & Orchestrator Mounting tests
  const discoverTool = HubActions.discoverAgentNodesAction();
  const diningSearch = await discoverTool.execute({ query: "dining" });
  assert(diningSearch.ok === true && diningSearch.count >= 1, "TripSteward discovers specialist agents by query");
  assert(diningSearch.results.some(r => r.id === "tablebespoke"), "TripSteward finds TableBespoke Dining node");

  const adventureSearch = await discoverTool.execute({ category: "Adventures" });
  assert(adventureSearch.ok === true && adventureSearch.results.some(r => r.id === "alpinetrail"), "TripSteward discovers agents by capability category");

  // Verify all 4 specialist catalog entries resolve
  const fullDirectory = await discoverTool.execute({});
  assert(fullDirectory.results.some(r => r.id === "alpinetrail"), "Discovery directory resolves AlpineTrail node");
  assert(fullDirectory.results.some(r => r.id === "luggagefly"), "Discovery directory resolves LuggageFly node");
  assert(fullDirectory.results.some(r => r.id === "travelshield"), "Discovery directory resolves TravelShield node");

  // Test dynamic arrival buffer engine for arbitrary flight times & meridiem boundary crossing
  const customQuote = await quoteTool.execute({ pickup_time: "2:15 PM", flight_number: "DL 1204" });
  assert(customQuote.calculated_pickup_time.includes("2:45 PM"), "CityGlide computes dynamic buffer for non-4:30 PM flights (2:15 PM -> 2:45 PM)");

  const noonFlipQuote = await quoteTool.execute({ pickup_time: "11:45 AM", flight_number: "UA 101" });
  assert(noonFlipQuote.calculated_pickup_time.includes("12:15 PM"), "CityGlide computes dynamic buffer flipping AM to PM across noon boundary (11:45 AM -> 12:15 PM)");

  const midnightFlipQuote = await quoteTool.execute({ pickup_time: "11:45 PM", flight_number: "UA 102" });
  assert(midnightFlipQuote.calculated_pickup_time.includes("12:15 AM"), "CityGlide computes dynamic buffer flipping PM to AM across midnight boundary (11:45 PM -> 12:15 AM)");

  // Test multi-hub fleet filtering
  const seaFleet = await fleetTool.execute({ hub: "SEA" });
  assert(seaFleet.requested_hub === "SEA", "CityGlide accepts airport hub parameter");
  assert(seaFleet.fleet_inventory.length >= 1, "CityGlide filters Seattle fleet inventory correctly");

  // Test honest no-match handling in MetroPass
  const noMatchSearch = await searchTool.execute({ city: "Tokyo", category: "all" });
  assert(noMatchSearch.matched_count === 0, "MetroPass returns 0 matches for uncataloged cities without silent fallback");

  // Test verified total cost calculation in master itinerary
  assert(masterRes.verified_total_usd > 0, "TripSteward computes verified total cost across real bookings");

  const registerTool = HubActions.registerAgentNodeAction();
  const registerRes = await registerTool.execute({
    node_url: "https://example.com/agents/custom-guide",
    name: "SummitPeak Trail Guides",
    category: "Mountain Guiding",
    front_man: "mountain_ranger"
  });
  assert(registerRes.ok === true && registerRes.agent.id === "custom-summitpeak-trail-guides", "TripSteward registers dynamic agent node on the fly");
  assert(registerRes.total_registered_agents >= 3, "TripSteward updates federated swarm count dynamically");

  // 4.5. Validating Runtime Action Module Contract & Bridge Availability
  console.log("\n4.5. Validating Runtime Action Module Contract & Bridge Availability...");
  const siteDirs = [
    { name: "tripsteward-hub", url: hubActionsUrl },
    { name: "cityglide-node", url: cityglideActionsUrl, isPeer: true },
    { name: "metropass-node", url: metroActionsUrl, isPeer: true }
  ];

  for (const s of siteDirs) {
    const mod = await import(s.url);
    assert(typeof mod.registerActions === "function", `${s.name} exports top-level registerActions(actions) conforming to nsdeploy runtime import contract`);
    
    const registered = [];
    const mockActions = {
      register: (def) => registered.push(def)
    };
    await mod.registerActions(mockActions);
    assert(registered.length > 0, `${s.name} registerActions successfully registers action tools`);

    if (s.isPeer) {
      const allBridge = registered.every(a => a.availability === "bridge");
      assert(allBridge, `${s.name} actions declare availability: 'bridge' for cross-origin bridge visibility`);
      const allAllowed = registered.every(a => Array.isArray(a.callerOrigins) && (a.callerOrigins.includes("*") || a.callerOrigins.length > 0));
      assert(allAllowed, `${s.name} actions declare valid callerOrigins allowing cross-origin orchestrators`);
    }
  }

  // 5. Dogfood & Validate with open-agentic-web SDK
  console.log("\n5. Testing Open Agentic Web SDK & Dynamic Federation Engine...");
  const sdkModuleUrl = existsSync(join(rootDir, "node_modules", "open-agentic-web"))
    ? "open-agentic-web"
    : pathToFileURL(join(rootDir, "packages", "open-agentic-web", "src", "index.js")).href;
  const { validateNode, validateFederation, defineAction, createActionRegistry, validateSchema, AgentSwarm } = await import(sdkModuleUrl);

  // Validate nodes using SDK
  const hubNodeReport = await validateNode(join(rootDir, "sites", "tripsteward-hub"));
  assert(hubNodeReport.valid === true, "open-agentic-web validates tripsteward-hub node with 0 errors");

  const ridesNodeReport = await validateNode(join(rootDir, "sites", "cityglide-node"));
  assert(ridesNodeReport.valid === true, "open-agentic-web validates cityglide-node with 0 errors");

  const metroNodeReport = await validateNode(join(rootDir, "sites", "metropass-node"));
  assert(metroNodeReport.valid === true, "open-agentic-web validates metropass-node with 0 errors");

  // Validate multi-site federation using SDK
  const fedMeshReport = await validateFederation(
    join(rootDir, "sites", "tripsteward-hub"),
    [join(rootDir, "sites", "cityglide-node"), join(rootDir, "sites", "metropass-node")]
  );
  assert(fedMeshReport.valid === true, "open-agentic-web validates complete 3-site federated mesh");
  assert(fedMeshReport.totalPassed >= 70, `open-agentic-web passed all ${fedMeshReport.totalPassed} mesh conformance checks`);

  // Test SDK Action creation & runtime schema validation
  const testAction = defineAction({
    name: "website_test_booking",
    description: "SDK action definition test",
    effect: "irreversible",
    inputSchema: {
      type: "object",
      properties: { party_size: { type: "integer", minimum: 1 } },
      required: ["party_size"],
      additionalProperties: false
    },
    execute: async (args) => ({ confirmed: true, guests: args.party_size })
  });

  const actionSuccess = await testAction.execute({ party_size: 2 });
  assert(actionSuccess.confirmed === true && actionSuccess.guests === 2, "open-agentic-web defineAction executes valid arguments");

  let caughtError = false;
  try {
    await testAction.execute({ party_size: -5 });
  } catch (err) {
    caughtError = true;
  }
  assert(caughtError === true, "open-agentic-web defineAction rejects invalid arguments at runtime");

  // Test SDK AgentSwarm in-browser manager
  const swarm = new AgentSwarm();
  swarm.registerNode({
    id: "partner_rides",
    name: "CityGlide Autonomous Fleet",
    category: "Mobility",
    front_man: "transfer_dispatcher",
    tools: ["website_quote_transfer_service"]
  });
  const searchMobility = swarm.search({ category: "Mobility" });
  assert(searchMobility.length === 1 && searchMobility[0].id === "partner_rides", "open-agentic-web AgentSwarm registers and searches active peers");
  const exportedLinks = swarm.exportLinks("tripsteward_concierge");
  assert(exportedLinks.networks.tripsteward_concierge !== undefined, "open-agentic-web exports dynamic links mapping format");

  console.log("\n========================================================");
  console.log(`Test Summary: ${passed} passed, ${failed} failed.`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

testActions().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
