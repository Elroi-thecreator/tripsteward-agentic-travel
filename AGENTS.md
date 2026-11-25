# AI Agent Operating Guidelines & Knowledge Base Protocol

Welcome to the **TripSteward: Autonomous Federated Travel, Hotel & City Mobility Concierge** repository.
All autonomous AI coding agents (Antigravity, Claude, Cursor, Gemini, Copilot, Codex, etc.) working in this repository must strictly follow this protocol.

---

## ⚡ MANDATORY STEP 1: Pre-Change Knowledge Inspection

**Before designing, planning, or modifying any code, configuration, or documentation in this repository:**

1. **Check the `knowledge/` folder** in the project root.
2. **Open and read `knowledge/index.yaml`** to identify the active architecture (`ARCH-*`), development (`DEV-*`), product (`PROD-*`), and decision (`ADR-*`) standards that apply to your task.
3. **Inspect the relevant standards**:
   - `knowledge/product/PROD-001-challenge-spec-and-rules.md`: Open Agentic Web specification & hackathon submission protocol.
   - `knowledge/architecture/ARCH-002-tripsteward-federated-architecture.md`: TripSteward autonomous federated travel & cross-site booking architecture.
   - `knowledge/architecture/ARCH-001-curapilot-consensus-architecture.md`: Founding multi-specialist consensus architecture.
   - `knowledge/development/DEV-001-runtime-and-site-actions.md`: In-browser runtime conventions, site-actions (`website_*`), and Otari BYOK inference standards.
   - `knowledge/development/DEV-002-vm-production-deployment.md`: Production VM deployment, systemd, and reverse proxy standards.
   - `knowledge/development/DEV-003-agent-authoring-and-onboarding-guide.md`: Agent authoring, dynamic discovery, and onboarding standards.
   - `knowledge/development/DEV-004-open-agentic-web-sdk.md`: Open Agentic Web SDK, conformance linter CLI, and actions framework standards.
4. **Ground all architectural and implementation decisions in these approved standards.** Never invent conflicting conventions or bypass existing specifications.

---

## 🔄 MANDATORY STEP 2: Post-Change Knowledge Synchronization

**Whenever you make modifications to code, schemas, routes, or behaviors:**

1. **Update the relevant knowledge units** in `knowledge/` to reflect changes (e.g. new action tools, updated parameters, schema adjustments).
2. **If introducing a new pattern or standard**, create a new markdown file in `knowledge/<domain>/` adhering to the required schema:
   - Frontmatter: `id`, `type`, `title`, `domain`, `status`, `version`
   - Sections: `## Rule`, `## Do`, `## Dont`, `## Reason`, `## Related Items`
3. **Update `knowledge/index.yaml`**:
   - Increment `knowledge_units_count`
   - Update `last_updated` date (YYYY-MM-DD)
   - Add the new unit under its appropriate domain (`product`, `architecture`, `development`, or `decision`).
4. **Verify knowledge base integrity**: Ensure the knowledge base always reflects the true, latest state of the codebase.

---

## 🧭 Repository Structure & Map

```
devpost-Cognizant/
├── AGENTS.md                  # Universal AI agent instructions (this file)
├── CLAUDE.md                  # Claude Code agent instructions
├── GEMINI.md                  # Gemini CLI & Antigravity agent instructions
├── .cursorrules               # Cursor IDE agent instructions
├── .github/
│   └── copilot-instructions.md# GitHub Copilot workspace instructions
├── knowledge/                 # ⭐️ Central knowledge base (Single Source of Truth)
│   ├── index.yaml             # Master index of all approved knowledge units
│   ├── product/               # Product standards & specifications (PROD-*)
│   ├── architecture/          # System design & cross-site invariants (ARCH-*)
│   └── development/           # Runtime, site-actions, and setup (DEV-*)
├── sites/                     # 3 federated static agentic web nodes
│   ├── tripsteward-hub/       # Port 8080: HarborView Hotel & Travel Concierge Hub
│   ├── cityglide-node/        # Port 8081: CityGlide Autonomous Fleet & Transfers Node
│   └── metropass-node/        # Port 8082: MetroPass Experiences & Ticketing Node
├── scripts/                   # Server runners and build utilities
│   ├── serve_all.mjs          # Concurrently boots all 3 nodes (8080, 8081, 8082)
│   ├── serve_vm.mjs           # Production VM runner (8880, 8881, 8882)
│   └── serve_site.mjs         # Static HTTP server with CORS enabled
├── tests/                     # Automated conformance test suite
│   └── conformance_test.mjs   # 64-point Open Agentic Web specification validator
├── assets/                    # Project thumbnails, diagrams, and UI screenshots
├── package.json               # Project manifest and scripts
└── README.md                  # Architectural overview & quickstart documentation
```

---

## 🛡️ Core Architectural Invariants

1. **How Agents Use the Web to Act on Our Behalf**:
   - Rather than just chatting, personal agents discover live availability, hold boutique hotel rooms, synchronize arrival delay buffers with live flight tracking, and issue scannable event passes across 3 independent websites.
   - Eliminates 15–30% intermediary reseller fees ($142+ saved per typical booking).
2. **100% In-Browser Execution (Zero-Leakage Privacy)**:
   - Traveler preferences, itinerary details, and booking tokens reside **strictly in browser memory (RAM / client DOM)**.
   - Static hosting web servers receive **0 bytes** of customer data.
3. **Bring Your Own Key (BYOK) Inference**:
   - Powered by **Mozilla Otari** (`https://api.otari.ai/api/v1`) using default model `alibaba/qwen3.8-flash`, or OpenRouter/local models.
   - Website hosts pay **$0 for inference**.
   - API keys are stored solely in client browser `localStorage` by the browser runtime; never hardcode or transmit keys.
4. **Decentralized Multi-Agent Federation**:
   - `tripsteward-hub` resolves peer specialist networks dynamically via `links.json`.
   - The user is prompted with an interactive consent card (`onConsent`) prior to fetching and running any third-party agent graph.
   - All declarative agent networks (`*.network.json`) and manifests (`agent-manifest.json`) are served with CORS headers (`Access-Control-Allow-Origin: *`).

---

## 🛠️ Essential Commands & Workflows

### Run Conformance Test Suite (Always run after any change)
```bash
npm test
```
*Validates JSON schemas, Neuro SAN graphs, agent manifests, peer link resolution, and site actions across all 3 nodes (64 checks).*

### Start Local Federated Network (Boots ports 8080, 8081, 8082)
```bash
npm start
```

### Start Individual Nodes
```bash
npm run serve:hub          # TripSteward Hub on http://localhost:8080
npm run serve:rides        # CityGlide Node on http://localhost:8081
npm run serve:experiences  # MetroPass Node on http://localhost:8082
```

---

## 📋 Coding & Modification Rules

- **Declarative Separation**: Keep agent graphs purely declarative in `*.network.json`. Ground tools strictly in `site-actions.js` under `website_*` namespaces.
- **Action Tool Schema Validation**: All tools in `site-actions.js` must specify JSON Schema parameters (`type`, `properties`, `required`).
- **Confirmation Modals**: Any action tool that modifies state or performs sensitive operations must hook into `onActionConfirm` for user approval.
- **No Server Dependencies in Frontend**: Never import server-only Node modules (`fs`, `child_process`, etc.) into client-side scripts under `sites/`.
- **Always Verify**: Run `npm test` and ensure all 64 checks pass without errors.
