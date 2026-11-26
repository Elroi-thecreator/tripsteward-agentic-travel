# DEV-001: In-Browser Runtime, Site Actions & Otari BYOK Standards

---
id: "DEV-001"
type: "development"
title: "In-Browser Runtime, Site Actions & Otari BYOK Standards"
domain: "development"
status: "APPROVED"
version: "1.1.0"
---

## Rule
All code in this project must adhere to the standard Open Agentic Web implementation patterns:

1. **Browser Runtime Deployment**:
   - The runtime module must be located in `runtime/` and initialized in `site.js` using `boot("#agent-app", { originUrl, sandboxWorkerUrl })`.
   - The runtime manages chat rendering, execution streaming, confirmation dialogs, and LLM communication.
2. **Site Action Registration (`website_*` tools)**:
   - Site actions must be defined in `site-actions.js` and declared in `agent-manifest.json` under `actions.agentTools`.
   - All action arguments must declare strict JSON Schema types (`type`, `properties`, `required`).
   - Read actions (`get_patient_clinical_record`) execute without dialog; write or irreversible actions (`flag_clinical_contraindication`, `generate_consensus_dossier`) must hook into `onActionConfirm` for user verification.
3. **Bring-Your-Own-Key (BYOK) Inference**:
   - Primary default provider: **Mozilla Otari** at `https://api.otari.ai/api/v1` with default model `alibaba/qwen3.8-flash`.
   - Key storage: Strictly origin-scoped `localStorage` handled directly by the browser runtime engine.
   - For offline/local development, mock mode or local Ollama endpoints are supported.
4. **Peer Linking Specification**:
   - Peer origins must be declared in `allowed_peers` in `agent-manifest.json` when `peer_policy.mode` is `"closed"`.
   - `links.json` maps symbolic external network names to concrete HTTP/HTTPS URLs pointing to the peer network's base folder.
   - The runtime must prompt the visitor with an interactive consent card (`onConsent`) prior to fetching and running any third-party agent graph.

## Do
- Validate all incoming action tool parameters against JSON schemas.
- Maintain separate development and production URL bindings in `links.json`.
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
