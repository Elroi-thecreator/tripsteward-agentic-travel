# DEV-004: Open Agentic Web Developer SDK & Conformance CLI Standards

---
id: "DEV-004"
type: "development"
title: "Open Agentic Web Developer SDK & Conformance CLI Standards"
domain: "development"
status: "APPROVED"
version: "1.1.0"
---

## Rule
All projects, nodes, and federated agent services in this repository and the broader ecosystem should use the extracted, reusable `open-agentic-web` npm package for conformance verification, site action definition, cross-origin bridging, and dynamic federation:

1. **Package Scope & Architecture**:
   - Location: `packages/open-agentic-web`
   - Zero external runtime dependencies: Built using standard Node.js built-ins (`node:fs`, `node:path`, `node:http`) and browser Web APIs (`MessageChannel`, `postMessage`, `fetch`, `AbortSignal`).
   - TypeScript definitions: Fully typed with `src/index.d.ts` exported via `"types"`.
   - Module Exports:
     - `open-agentic-web/validator`: Conformance linter for `agent-manifest.json`, `*.network.json`, `links.json`, and `site-actions.js` with deep action registration verification, live remote URL auditing, and true cross-site mesh federation auditing with `--json` reporting support.
     - `open-agentic-web/actions`: Grounded site actions creator (`defineAction`), pure-JS JSON schema validator (`validateSchema`) with `pattern`, `format`, `default` injection, `oneOf`, and `anyOf`, action registry with parameter catalogs, chronological audit logging (`getAuditLog()`), dedicated `undo()` handlers, multi-target tool adapters (`toOpenAITools()`, `toMCPTools()`, `registerWebMCP()`), standard Linux Foundation / Google Agent-to-Agent (A2A) Agent Card generator (`toA2AAgentCard`), and drop-in confirmation dialog modal (`createConsentDialog`).
     - `open-agentic-web/bridge`: Sandboxed cross-origin iframe execution bridge (`setupActionBridge`, `createActionBridgeClient`) adhering to the `nsdeploy-actions-v1` protocol. Implements fail-closed defaults (`allowedOrigins: []`), policy queueing to prevent asynchronous manifest fetch race conditions, pre-execution argument validation, and `AbortSignal` cancellation support on remote calls.
     - `open-agentic-web/federation`: Dynamic multi-agent swarm manager (`AgentSwarm`) supporting on-the-fly remote node mounting with interactive user consent (`onConsent`), tool collision safety across peers (`${nodeId}__${toolName}`), auto-routing to peer bridges, live catalog hydration, SSE token streaming (`stream: true`, `onToken`), and a provider-agnostic BYOK LLM tool-calling loop (`runTurn`) compatible with OpenAI, Anthropic, Gemini, Ollama, and custom adapters with `AbortSignal` support.
2. **CLI Standards (`open-agentic-web` / `oaw`)**:
   - `validate [paths...] [--json]`: Validates directories or live remote URLs (`http://`, `https://`) against the Cognizant / Mozilla / MIT NANDA MVP Profile 0.3 specification, verifying CORS headers and `X-Frame-Options` on deployed nodes.
   - `federation <hub> [peers...] [--json]`: Verifies mesh integrity, peer links, and cross-site compatibility, printing granular link-by-link pass/fail diagnostics.
   - `dev [dir] [--port 3000]`: Boots a zero-dependency local static server with CORS and serves an interactive browser test playground at `/playground` to test site actions and bridge handshakes before deployment.
   - `a2a [dir] [--out path]`: Generates standard Linux Foundation / Google Agent-to-Agent (A2A) Agent Cards (`.well-known/agent.json`) from conforming nodes.
   - `init [dir] [--name <name>]`: Scaffolds a 100% conforming agentic node with browser import maps dynamically pinned to the package version (`open-agentic-web@1.1.0`).
   - `inspect [path]`: Inspects declared tools, routers, and networks.
3. **Continuous Conformance & Automated Publishing**:
   - `npm test` runs both the root integration tests and the `open-agentic-web` package test suite.
   - All published nodes must pass `oaw validate` with 0 failures before deployment.
   - Automated GitHub Actions workflow (`.github/workflows/publish-npm.yml`) publishes the package to npm with cryptographic build provenance (`--provenance`) upon git release, tag push (`v*`), or manual workflow dispatch.

## Do
- Use `defineAction` with strict JSON schema definitions for all callable website tools.
- Tag each action tool with an appropriate `effect`: `"read"`, `"irreversible"`, or `"undoable"`.
- Validate all local and partner nodes using `npx open-agentic-web validate <path>`.
- Keep `open-agentic-web` zero-dependency to ensure compatibility across client and server environments.

## Dont
- Do NOT bypass `onConsent` hooks when mounting remote agent nodes dynamically.
- Do NOT execute actions marked `irreversible` without explicit user confirmation.
- Do NOT introduce bulky third-party dependencies into the core SDK package.

## Reason
Extracting the core Open Agentic Web protocols into a single, publishable npm package removes hundreds of lines of duplicated boilerplate across independent nodes, provides the first universal conformance testing CLI for the community, and standardizes browser-based multi-agent federation.

## Related Items
- `knowledge/index.yaml`
- `PROD-001`: Open Agentic Web Challenge Specification & Submission Protocol
- `ARCH-002`: TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture
- `DEV-001`: In-Browser Runtime, Site Actions & Otari BYOK Standards
- `DEV-003`: Agent Authoring, Dynamic Discovery & Onboarding Standards
