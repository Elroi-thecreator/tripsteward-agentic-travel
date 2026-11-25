# DEV-004: Open Agentic Web Developer SDK & Conformance CLI Standards

---
id: "DEV-004"
type: "development"
title: "Open Agentic Web Developer SDK & Conformance CLI Standards"
domain: "development"
status: "APPROVED"
version: "1.0.2"
---

## Rule
All projects, nodes, and federated agent services in this repository and the broader ecosystem should use the extracted, reusable `open-agentic-web` npm package for conformance verification, site action definition, cross-origin bridging, and dynamic federation:

1. **Package Scope & Architecture**:
   - Location: `packages/open-agentic-web`
   - Zero external runtime dependencies: Built using standard Node.js built-ins (`node:fs`, `node:path`) and browser Web APIs (`MessageChannel`, `postMessage`, `fetch`).
   - Module Exports:
     - `open-agentic-web/validator`: Conformance linter for `agent-manifest.json`, `*.network.json`, `links.json`, and `site-actions.js` with deep action registration verification and true cross-site mesh federation auditing.
     - `open-agentic-web/actions`: Grounded site actions creator (`defineAction`), pure-JS JSON schema validator (`validateSchema`), action registry with parameter catalogs, and human confirmation enforcement (`ActionSecurityError`).
     - `open-agentic-web/bridge`: Sandboxed cross-origin iframe execution bridge (`setupActionBridge`, `createActionBridgeClient`) adhering to the `nsdeploy-actions-v1` protocol. Defaults to `allowedOrigins: ["*"]` for open federation while mandating `onConfirm` gates for irreversible actions, with concurrency-safe iframe connection promises.
     - `open-agentic-web/federation`: Dynamic multi-agent swarm manager (`AgentSwarm`) supporting on-the-fly remote node mounting with interactive user consent (`onConsent`), runtime tool parameter schema hydration from declarative `*.network.json` (`network.hocon`), and an autonomous BYOK LLM tool-calling loop (`runTurn` & `getOpenAITools`) compatible with Mozilla Otari, OpenRouter, and OpenAI formats.
2. **CLI Standards (`open-agentic-web` / `oaw`)**:
   - `validate [paths...]`: Validates directories against the Cognizant / Mozilla / MIT NANDA MVP Profile 0.3 specification with deep action tool execution validation.
   - `federation <hub> [peers...]`: Verifies mesh integrity, peer links, and cross-site compatibility, printing granular link-by-link pass/fail diagnostics.
   - `init [dir] [--name <name>]`: Scaffolds a 100% conforming agentic node with browser import maps targeting the latest npm release (`open-agentic-web@1.0.2`).
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
