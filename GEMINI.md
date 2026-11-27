# Gemini & Antigravity Agent Guidelines — TripSteward Federated Travel Concierge

## ⚡ Mandatory Knowledge Base Protocol

**MANDATORY STEP 1: Pre-Change Knowledge Inspection**
- Before modifying or planning any changes in this workspace, open and read `knowledge/index.yaml`.
- Identify the relevant standards (`ARCH-*`, `DEV-*`, `PROD-*`, `ADR-*`).
- Ground all changes strictly in these approved specifications:
  - `knowledge/product/PROD-001-challenge-spec-and-rules.md` (Challenge specs)
  - `knowledge/architecture/ARCH-002-tripsteward-federated-architecture.md` (TripSteward federated cross-site booking architecture)
  - `knowledge/development/DEV-001-runtime-and-site-actions.md` (In-browser runtime & Otari BYOK)
  - `knowledge/development/DEV-002-vm-production-deployment.md` (Production VM deployment & reverse proxy architecture)
  - `knowledge/development/DEV-003-agent-authoring-and-onboarding-guide.md` (Agent authoring & dynamic onboarding standards)
  - `knowledge/development/DEV-004-open-agentic-web-sdk.md` (Open Agentic Web SDK & Conformance CLI standards)

**MANDATORY STEP 2: Post-Change Knowledge Synchronization**
- When modifying code or configuration, immediately update the relevant knowledge units in `knowledge/`.
- If introducing a new pattern or rule, author a new knowledge unit following the required schema (`id`, `type`, `title`, `domain`, `status`, `version`, `rule`, `do`, `dont`, `reason`, `related_items`).
- Increment `knowledge_units_count`, update `last_updated`, and add the entry in `knowledge/index.yaml`.

---

## 🧭 Project Architecture & Sites
This repository implements **TripSteward: Autonomous Federated Travel, Hotel & City Mobility Concierge** adhering to the **Cognizant Open Agentic Web Challenge (MVP Profile 0.3)**:
- **`sites/tripsteward-hub` (Port 8080 / path `/tripsteward/`)**: Traveler intake vault, HarborView room holds, Chief Travel Concierge agent (`tripsteward_concierge.network.json`), peer link resolution (`links.json`).
- **`sites/cityglide-node` (Port 8081 / path `/rides/`)**: CityGlide Autonomous Fleet (`cityglide_transfer.network.json`, flight tracking, arrival delay buffer calculation, chauffeur dispatch).
- **`sites/metropass-node` (Port 8082 / path `/experiences/`)**: MetroPass Experiences (`metropass_experiences.network.json`, sunset cruises, SFMOMA VIP passes, instant QR voucher issuance).

---

## 🔒 Security & Invariants
1. **Action-Driven Personal Agents**: Agents directly execute reservations and ticket issuance across independent sites, eliminating 15–30% aggregator markups.
2. **Zero-Leakage Privacy**: All traveler preferences and booking tokens are processed client-side in browser memory. Zero bytes transmitted to backend servers.
3. **BYOK Inference**: Mozilla Otari (`alibaba/qwen3.8-flash`) or visitor-provided keys. Website hosts pay $0 for inference.
4. **User Consent**: Cross-site agent invocations require interactive user confirmation (`onConsent`).
5. **CORS & Declarative JSON**: Declarative Neuro SAN networks served statically with CORS enabled (`*`).

---

## 🛠️ Verification & Run Commands
```bash
npm test               # Run 143-point Open Agentic Web conformance test suite
npm run serve:hub      # Boot TripSteward Hub (8080)
npm run serve:rides    # Boot CityGlide Node (8081)
npm run serve:experiences # Boot MetroPass Node (8082)
npx oaw mcp            # Launch Model Context Protocol (MCP) server over stdio
```
