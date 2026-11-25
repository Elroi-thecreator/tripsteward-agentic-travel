# Claude Code Guidelines — TripSteward Federated Travel Concierge

## ⚡ Mandatory Knowledge Base Protocol

**CRITICAL RULE FOR ALL TASKS:**
1. **Pre-Change Knowledge Inspection (Step 1)**:
   - Before designing, planning, or editing any file, inspect `knowledge/index.yaml`.
   - Read the relevant architecture (`ARCH-*`), development (`DEV-*`), product (`PROD-*`), and decision (`ADR-*`) standards that apply to your task.
   - Ground all architectural and implementation decisions in these approved standards.
2. **Post-Change Knowledge Synchronization (Step 2)**:
   - When modifying code or configuration, immediately update the corresponding units in `knowledge/`.
   - When introducing new patterns or decisions, create a new document in `knowledge/<domain>/` following the required schema (`id`, `type`, `title`, `domain`, `status`, `version`, `rule`, `do`, `dont`, `reason`, `related_items`).
   - Update `knowledge/index.yaml` (`knowledge_units_count`, `last_updated`, and add the entry).

---

## 🧭 Knowledge Base Directory Reference
- `knowledge/index.yaml`: Master registry of all knowledge units.
- `knowledge/product/PROD-001-challenge-spec-and-rules.md`: Open Agentic Web specification & submission requirements.
- `knowledge/architecture/ARCH-002-tripsteward-federated-architecture.md`: Autonomous federated travel & cross-site booking architecture.
- `knowledge/development/DEV-001-runtime-and-site-actions.md`: In-browser runtime, action tools (`website_*`), and BYOK Otari inference standards.
- `knowledge/development/DEV-002-vm-production-deployment.md`: Production VM deployment, systemd, and reverse proxy architecture.
- `knowledge/development/DEV-003-agent-authoring-and-onboarding-guide.md`: Agent authoring, dynamic discovery, and onboarding standards.
- `knowledge/development/DEV-004-open-agentic-web-sdk.md`: Open Agentic Web SDK, conformance linter CLI, and actions framework standards.

---

## 🛠️ Build, Test & Development Commands
- **Run Conformance Tests**: `npm test` (Runs `node tests/conformance_test.mjs`, must pass 69/69 tests)
- **Start All Federated Sites**: `npm start` (Runs `node scripts/serve_all.mjs`, serving ports 8080, 8081, 8082)
- **Serve Individual Sites**:
  - `npm run serve:hub`: Starts TripSteward Concierge Hub on `http://localhost:8080/`
  - `npm run serve:rides`: Starts CityGlide Transfer Node on `http://localhost:8081/`
  - `npm run serve:experiences`: Starts MetroPass Experiences Node on `http://localhost:8082/`

---

## 🛡️ Core Architecture & Boundaries
- **How Agents Use the Web to Act on Our Behalf**:
  - Personal agents discover live inventory, hold hotel rooms, coordinate airport chauffeur transfers with flight delay buffers, and issue scannable activity tickets.
  - Eliminates 15–30% aggregator platform markups ($142+ saved per itinerary).
- **Open Agentic Web MVP Profile 0.3**:
  - Client-side execution in the browser via `nsdeploy` runtime.
  - BYOK (Bring Your Own Key) inference via Mozilla Otari (`alibaba/qwen3.8-flash`) or local models. Hosts pay $0.
  - Public JSON artifacts: `agent-manifest.json`, `*.network.json`, `links.json`, `bridge/action-bridge.html`.
- **Peer Linking & Consent**:
  - Interactive consent cards (`onConsent`) must guard third-party agent graph loading.
  - CORS headers (`Access-Control-Allow-Origin: *`) must be enabled on all published JSON files.
