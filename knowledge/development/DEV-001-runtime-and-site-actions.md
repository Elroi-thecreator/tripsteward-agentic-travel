# DEV-001: In-Browser Runtime, Site Actions & Otari BYOK Standards

---
id: "DEV-001"
type: "development"
title: "In-Browser Runtime, Site Actions & Otari BYOK Standards"
domain: "development"
status: "APPROVED"
version: "1.2.0"
---

## Rule
All code in this project must adhere to the standard Open Agentic Web implementation patterns:

1. **Browser Runtime Deployment**:
   - The runtime module must be located in `runtime/` and initialized in `site.js` using `boot("#agent-app", { originUrl, sandboxWorkerUrl })`.
   - The runtime manages chat rendering, execution streaming, confirmation dialogs, and LLM communication.
   - Declarative network files (`*.network.json`) must specify both `"model_name"` and `"model"` in `"llm_config"` (e.g. `"alibaba/qwen3.8-flash"`) so that runtime model inheritance reliably resolves caller models.
2. **Site Action Registration (`website_*` tools)**:
   - Site actions must be defined in `site-actions.js` and declared in `agent-manifest.json` under `actions.agentTools`.
   - All action arguments must declare strict JSON Schema types (`type`, `properties`, `required`).
   - Read actions execute without dialog; write or irreversible actions must hook into `onActionConfirm` for user verification.
   - Action review hooks (`reviewAction`) receive an array of action items (`items`); handlers must inspect `items[0]?.action` or `items[0]?.name`.
3. **Bring-Your-Own-Key (BYOK) Inference**:
   - Primary default provider: **Mozilla Otari** at `https://api.otari.ai/api/v1` with default model `alibaba/qwen3.8-flash`.
   - Key storage: Strictly origin-scoped `localStorage` handled directly by the browser runtime engine.
   - For offline/local development, mock mode or local Ollama endpoints are supported.
4. **Peer Linking & User Consent Gateway**:
   - Peer origins must be declared in `allowed_peers` in `agent-manifest.json` when `peer_policy.mode` is `"closed"`.
   - `links.json` maps symbolic external network names to concrete HTTP/HTTPS URLs pointing to the peer network's base folder.
   - Declarative networks declare external tools using `link_slots` (e.g. `"cityglide": {}`, `"metropass": {}`) and tool references `["cityglide", "metropass"]`, allowing automatic local rebinding on `localhost` (ports 8080/8081/8082).
   - The runtime must prompt the visitor with an interactive consent card (`onConsent`) prior to fetching and running any third-party agent graph.
   - Consent handlers must return `"allow"` on user approval or `"decline"` on cancellation. Runtime engines must treat `false` or `"decline"` as a strict decline to prevent bypasses.

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
