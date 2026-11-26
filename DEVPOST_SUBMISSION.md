# 🏆 TripSteward — Devpost Submission Details

This document contains the exact, copy-paste ready submission text for the **Cognizant Open Agentic Web Challenge** on Devpost.

---

### Project Title
**TripSteward: Autonomous Federated Travel, Hotel & City Mobility Concierge**

### Tagline
**The first autonomous cross-site booking network and universal developer SDK (`open-agentic-web`) for the Open Agentic Web.**

---

### Project Links
- **Primary Live Concierge Hub:** [https://pnrs.is-a.dev/tripsteward/](https://pnrs.is-a.dev/tripsteward/)
- **CityGlide Autonomous Fleet Node:** [https://pnrs.is-a.dev/rides/](https://pnrs.is-a.dev/rides/)
- **MetroPass Experiences Node:** [https://pnrs.is-a.dev/experiences/](https://pnrs.is-a.dev/experiences/)
- **npm Package (Developer SDK & Conformance CLI):** [https://www.npmjs.com/package/open-agentic-web](https://www.npmjs.com/package/open-agentic-web)
- **GitHub Repository:** [https://github.com/Elroi-thecreator/tripsteward-agentic-travel](https://github.com/Elroi-thecreator/tripsteward-agentic-travel)

---

### 💡 Inspiration

Traditional web assistants are purely conversational: you chat with them, and they dump walls of text or links back at you, forcing you to manually browse three different websites, copy-paste flight times, calculate baggage delays, and book each ticket yourself.

Meanwhile, online travel agencies (OTAs like Expedia, Booking.com, Viator) operate as **rent-seeking walled gardens**:
- They charge **15% to 30% platform aggregator markups** on hotel rooms, airport rides, and city activities.
- They hide real-time provider telemetry (e.g. flight arrival delays and baggage pickup buffers).
- They harvest and monetize your private travel itineraries.

Inspired by Cognizant's keynote vision—*"What it means to Agentify your website"*—we built **TripSteward**: proof that websites can expose standard, machine-executable action tools so your personal AI agent can navigate the web, negotiate availability, and execute transactions directly with providers on your behalf.

---

### ✈️ What It Does

TripSteward federates three independent agentic web properties into a decentralized, zero-middleman booking collective with on-the-fly dynamic agent discovery:

1. **HarborView Hotel & TripSteward Orchestrator Hub (`/tripsteward/`):**
   - Stores traveler preferences, telemetry, and budget strictly in sovereign client browser memory—with zero hardcoded static trips.
   - Hosts the **Chief Travel Orchestrator Agent** (`travel_concierge`), which inspects hotel inventory, holds boutique rooms (`website_reserve_hotel_room`), and dynamically negotiates with peer specialist nodes.
   - **Dynamic On-the-Fly Agent Discovery & Swarm Expansion**: Discovers new specialist nodes across dining, adventures, baggage couriers, and insurance via `website_discover_agent_nodes`, or mounts any external conforming agent node URL on the fly via `website_register_agent_node`.
2. **CityGlide Autonomous Fleet & Transfers Node (`/rides/`):**
   - Independent ground transport authority.
   - Evaluates incoming flight numbers (e.g. `UA 482`), automatically computes a **30-minute baggage collection buffer**, and dispatches executive EV chauffeurs (`website_schedule_airport_transfer`) at direct provider rates ($68 vs $92 on aggregators).
3. **MetroPass Experiences & City Curations Node (`/experiences/`):**
   - Independent cultural activity authority.
   - Discovers verified local activities (`website_search_experiences`), reserves VIP admission, and issues scannable mobile QR passes (`website_book_experience_pass`) with 0% reseller fees.
4. **Master Digital Travel Pass Synthesis:**
   - Compiles all confirmed provider reservations into a single, cohesive master pass (`website_compile_master_itinerary`) with verified itemized savings (**$161.00 saved** on direct provider rates: $604.00 direct vs $765.00 OTA aggregator markup).
5. **Universal Developer SDK & Conformance CLI (`open-agentic-web` on npm):**
   - Beyond the 3 live sites, we extracted the foundational plumbing into a zero-dependency, open-source npm package (`open-agentic-web@1.1.3`) so any developer can build, test, and federate conforming agentic websites in minutes.
6. **Dual-Mode User Experience (Real BYOK LLM + Honest Demo Preview):**
   - **Real BYOK Live Inference**: Visitors can enter an Otari (`alibaba/qwen3.8-flash`), OpenRouter, or OpenAI key in chat settings to execute multi-turn, multi-agent autonomous tool calling in real-time.
   - **Honest Offline Demo Flow (`▶ Preview Demo Flow (No Key)`)**: Clear, transparent simulated walk-through allowing judges and reviewers without active API keys to preview the end-to-end multi-agent orchestration without breaking the illusion of real LLM inference.
7. **Strict Bridge Architecture & Conformance (`nsdeploy-actions-v1`)**:
   - All site action modules adhere to the official runtime import contract via top-level `export function registerActions(actions)`.
   - Cross-origin peer capabilities declare `availability: "bridge"` and `callerOrigins: ["*"]` so actions are cleanly discoverable across isolated iframe boundaries.
   - Genuine cross-node consent isolation enforced via `requiresThirdPartyApproval` across subpath boundaries (`/tripsteward/`, `/rides/`, `/experiences/`), guaranteeing the interactive `onConsent` security gateway triggers genuinely.

---

### 🛠️ How We Built It

- **100% Client-Side In-Browser Execution**:
  - All agent networks are described purely as declarative data (`agent-manifest.json` and Neuro SAN `*.network.json` graphs).
  - Executed client-side in the browser via JavaScript. The site host pays **$0 for inference**.
- **Bring Your Own Key (BYOK) Inference**:
  - Powered by **Mozilla Otari** (`https://api.otari.ai/api/v1` with `alibaba/qwen3.8-flash`), OpenRouter, or user-supplied keys.
- **Sandboxed Action Bridge (`bridge/action-bridge.html`)**:
  - Uses the `nsdeploy-actions-v1` cross-origin iframe protocol over isolated `MessageChannel` ports with fail-closed security and human consent prompts (`onConsent` / `onActionConfirm`) for irreversible operations.
- **The `open-agentic-web` SDK (npm)**:
  - `oaw validate`: Conformance linter checking manifest schemas, declarative graphs, live remote URLs, CORS headers, and `X-Frame-Options`.
  - `oaw federation`: Multi-site mesh auditor checking peer link compatibility.
  - `oaw dev`: Built-in local dev server with CORS and an interactive browser test playground (`/playground`).
  - `oaw a2a`: Exporter converting `agent-manifest.json` into standard Google / Linux Foundation **Agent-to-Agent (A2A)** Agent Cards (`.well-known/agent.json`).
  - `defineAction` & `validateSchema`: Pure-JS schema validator supporting regex patterns, formats (`email`, `date`, `uri`, `uuid`), defaults, undoable actions, and audit logging.
- **Production Infrastructure**:
  - Live multi-node deployment with SSL certificates on Oracle Cloud ARM64 VM (`https://pnrs.is-a.dev/`).
  - 108 automated unit and conformance test checks running in CI/CD (88 cluster node checks + 20 SDK test checks).

---

### 🧗 Challenges We Ran Into

1. **Cross-Origin Handshakes Without Data Leakage**: Enabling parent orchestrators to execute child iframe tools without leaking user session tokens or exposing the site to clickjacking required designing a sandboxed postMessage protocol with strict origin validation and interactive modal consent.
2. **Dynamic Swarm Tool Collisions**: When mounting arbitrary external agent nodes at runtime, two providers might expose identical action names (e.g. `website_query_inventory`). We implemented automatic namespacing (`${nodeId}__${toolName}`) and ambiguity detection to ensure deterministic execution.
3. **Zero-Dependency Guarantee**: To ensure the SDK works in any browser, static host, or edge runtime without massive bundling overhead, we built our JSON schema validator, A2A generator, and dev server entirely with native Web APIs and Node.js built-ins.

---

### 🏆 Accomplishments That We're Proud Of

- **First True Autonomous Booking Network**: Personal agents directly book hotel rooms, schedule arrival-delayed rides, and issue passes across independent websites.
- **Measurable Real-World Value**: Demonstrates direct **$161.00 traveler savings** ($604.00 direct vs $765.00 aggregator markup) by cutting out aggregator commissions.
- **Ecosystem Contribution**: Published `open-agentic-web` on npm with full TypeScript declarations, automated provenance, and an interactive developer playground.
- **Standards Bridge**: Pioneered bidirectional interoperability between Cognizant MVP Profile 0.3, Model Context Protocol (MCP), WebMCP (`navigator.modelContext`), and Linux Foundation / Google Agent-to-Agent (A2A).

---

### 📖 What We Learned

- Giving websites declarative machine APIs (`agentTools` + `agent-manifest.json`) transforms the web from a visual human bottleneck into an autonomous execution canvas.
- BYOK (Bring Your Own Key) inference is essential for sustainable agentic web hosting: publishers can expose powerful agentic services without worrying about runaway LLM API costs.

---

### 🔮 What's Next for TripSteward

- **Web Monetization & Agent Micropayments**: Implementing streaming token micropayments (HTTP 402 / Web Monetization) so websites can earn instant fees for specialized tool execution.
- **Autonomous Multi-City Itineraries**: Expanding the swarm to Tokyo, London, and Paris with automated multi-currency conversion and international train passes.
- **Ecosystem Adoption**: Partnering with independent boutique hotels and mobility fleets to adopt `open-agentic-web` manifests for direct booking.

---

### 🧰 Built With
`JavaScript`, `Node.js`, `Mozilla Otari`, `Qwen 3.8 Flash`, `Neuro SAN`, `Open Agentic Web MVP Profile 0.3`, `Model Context Protocol (MCP)`, `Agent-to-Agent (A2A)`, `CSS3`, `HTML5`, `Oracle Cloud Infrastructure`
