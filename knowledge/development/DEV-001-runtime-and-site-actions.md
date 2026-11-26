# DEV-001: In-Browser Runtime, Site Actions & Otari BYOK Standards

---
id: "DEV-001"
type: "development"
title: "In-Browser Runtime, Site Actions & Otari BYOK Standards"
domain: "development"
status: "APPROVED"
version: "1.4.0"
---

## Rule
All code in this project must adhere to the standard Open Agentic Web implementation patterns:

1. **Browser Runtime Deployment**:
   - The runtime module must be located in `runtime/` and initialized in `site.js` using `boot("#agent-app", { originUrl, sandboxWorkerUrl })`.
   - The runtime manages chat rendering, execution streaming, confirmation dialogs, and LLM communication.
   - Declarative network files (`*.network.json`) must specify both `"model_name"` and `"model"` in `"llm_config"` (e.g. `"alibaba/qwen3.8-flash"`) so that runtime model inheritance reliably resolves caller models.
2. **Site Action Registration & Multi-Agent Planning**:
   - Site actions must be defined in `site-actions.js` and declared in `agent-manifest.json` under `actions.agentTools`.
   - All action arguments must declare strict JSON Schema types (`type`, `properties`, `required`).
   - Read actions execute without dialog; write or irreversible actions must hook into `onActionConfirm` for user verification.
   - Hub networks implement a 3-agent hierarchy (`travel_concierge` orchestrator, `itinerary_conflict_auditor` internal critic, `schedule_and_budget_solver` constraint solver) with registered action `solve_itinerary_constraints`.
   - Action review hooks (`reviewAction`) receive an array of action items (`items`); handlers must inspect `items[0]?.action` or `items[0]?.name`.
   - Action bridge handshakes must support both explicit `{ type: "connected" }` signals and proactive catalog pings (`{ id: 0, type: "catalog" }`) to ensure zero-timeout interoperability across both `open-agentic-web` and `nsdeploy` starter runtimes.
3. **Cryptographic Action Receipts & Public Verification Keys**:
   - Provider nodes sign irreversible booking actions (rooms, transfers, passes) using native WebCrypto ECDSA P-256 (`crypto.subtle` with `SHA-256` / `ES256`).
   - Signing private keys are never committed in plaintext in client scripts; they are managed server-side via `POST /api/sign-receipt` or generated ephemerally in browser RAM.
   - Every signed receipt includes `algorithm: "ES256"`, `kid`, `provider`, `issuedAt`, `payload`, `canonicalPayload`, and `signature`.
   - Provider public keys are exposed in standard `.well-known/jwks.json` and dynamically resolved and cached by verifiers.
   - Sovereign clients cryptographically verify receipts in-browser using `crypto.subtle.verify`, catching any unauthorized tampering.
   - Cross-window event synchronization (`BroadcastChannel` and `postMessage`) strictly preserves `receipt` signatures and validates message origins against registered peer nodes.
4. **Cross-Session Shared Inventory Coordination**:
   - Provider nodes coordinate inventory (available rooms, standby fleet, remaining experience tickets) via `/api/inventory` to ensure consistency across multiple visitors and sessions without client-side state conflicts.
5. **Fail-Closed Dynamic Node Mounting & Tool Hot-Mounting**:
   - Dynamic agent registration (`addAgentOnTheFly`) validates manifest URLs and fails closed on HTTP 404 rather than mounting unreachable nodes.
   - Valid mounted nodes are dynamically hot-mounted into the live engine's `runtimeAllowedPeers`, link table, and agent spec tools.
6. **Authentic ISO/IEC 18004 QR Codes & RFC 5545 Calendar Export**:
   - Digital event and boarding passes render authentic 21x21 Model 2 Level M ISO/IEC 18004 QR codes generated with standard GF(256) Reed-Solomon polynomial division, scannable by physical camera scanners.
   - Itineraries export to universal RFC 5545 `.ics` calendar format with full VEVENT details for seamless import into Google Calendar, Apple Calendar, and Outlook.
7. **Bring-Your-Own-Key (BYOK) Inference**:
   - Primary default provider: **Mozilla Otari** at `https://api.otari.ai/api/v1` with default model `alibaba/qwen3.8-flash`.
   - Key storage: Strictly origin-scoped `localStorage` handled directly by the browser runtime engine.
   - For offline/local development, mock mode or local Ollama endpoints are supported.
8. **Peer Linking & User Consent Gateway**:
   - Peer origins must be declared in `allowed_peers` in `agent-manifest.json` when `peer_policy.mode` is `"closed"`.
   - `links.json` maps symbolic external network names to concrete HTTP/HTTPS URLs pointing to the peer network's base folder.
   - The runtime must prompt the visitor with an accessible confirmation dialog (`createConsentDialog` or custom `<dialog>`) prior to executing sensitive actions or connecting peer nodes, completely replacing blocking `alert()` or `confirm()`.
9. **Universal Flight Arrival & Buffer Calculation Engine**:
   - Airport ground transit nodes dynamically parse arbitrary arrival timestamps (`12h` or `24h` formats).
   - Flight delay buffers calculate +30 minutes for domestic arrivals and +45 minutes for international flights, dynamically added to estimated curbside pickup times.
   - Multi-city dynamic configuration supports localized flight telemetry, hotels, and activities across San Francisco, Seattle, and Austin with live Open-Meteo marine weather telemetry.

## Do
- Validate all incoming action tool parameters against JSON schemas.
- Maintain separate development and production URL bindings in `links.json`.
- Return explicit `"allow"` or `"decline"` strings from `onConsent` handlers.
- Specify `"model_name"` in all declarative network `llm_config` blocks.
- Provide meaningful sample queries in `agent-manifest.json`.

## Dont
- Do NOT perform unconfirmed state modifications.
- Do NOT bypass CORS or access third-party origins not declared in `links.json`.
- Do NOT bundle server-side Node dependencies in browser-delivered scripts.

## Reason
Adherence to these development standards ensures 100% interoperability with the Worldwide Agentic Web specification, guaranteeing pass/fail conformance in Stage 1 of judging.

## Related Items
- `knowledge/index.yaml`
- `PROD-001`: Open Agentic Web Challenge Specification & Submission Protocol
- `ARCH-002`: TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture
- `DEV-002`: Production VM Deployment & Reverse Proxy Architecture
