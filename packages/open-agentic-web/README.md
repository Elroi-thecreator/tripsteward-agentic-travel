# 🌐 Open Agentic Web SDK (`open-agentic-web`)

[![npm version](https://img.shields.io/badge/npm-v1.1.4-blue.svg)](https://www.npmjs.com/package/open-agentic-web)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Specification](https://img.shields.io/badge/Spec-Open%20Agentic%20Web%20MVP%200.3-orange.svg)](https://cognizant-ai-labs.github.io/agentic-web/specs/mvp-v0.3.json)

The **Open Agentic Web SDK** (`open-agentic-web`) is the zero-dependency SDK, conformance CLI & browser runtime for building, validating, and federating autonomous web agents.

Compliant with the **Cognizant AI Lab / Mozilla Otari / MIT NANDA Open Agentic Web (MVP Profile 0.3)** specification and the **Linux Foundation / Google Agent-to-Agent (A2A)** standard.

---

## ⚡ Why `open-agentic-web`?

In the emerging Agentic Web, AI agents don't just chat—they act directly on websites on behalf of users, discovering inventory, holding reservations, and issuing tickets across independent domains without aggregator markups.

Building a conforming agentic website previously required manually writing repetitive boilerplate:
1. **Manifest & Network validation**: No standard CLI existed to verify whether your `agent-manifest.json` or `*.network.json` met the Open Agentic Web specification.
2. **Action tool validation**: Tools called by LLMs (`website_*`) lacked standard runtime JSON schema enforcement, regex patterns, formats, defaults, and effect classification (`read` vs `irreversible` vs `undoable`).
3. **Cross-origin iframe bridging**: Implementing secure postMessage handshakes, origin filtering, and MessageChannels for `bridge/action-bridge.html` required hundreds of lines of fragile glue code.
4. **Dynamic Swarm Federation**: No reusable client existed to discover, consent-check, auto-route tools, and mount remote agent nodes in browser RAM on the fly.
5. **Standard Interoperability**: Bridging Neuro SAN graphs with the broader ecosystem (MCP, WebMCP, and A2A Agent Cards) required bespoke converters.

`open-agentic-web` provides a **zero-dependency**, universal toolkit for all of these needs.

---

## 📦 Installation

```bash
# Install globally or as a dev dependency for CLI validation
npm install -D open-agentic-web

# Or use directly with npx
npx open-agentic-web validate .
```

---

## 🚀 1. Conformance Linter & CLI (`oaw` / `open-agentic-web`)

Validate any agentic website, start an interactive local test playground, or export standard A2A Agent Cards.

### Validate Conformance
Run automated checks against `agent-manifest.json`, declarative `*.network.json` graphs, `bridge/action-bridge.html`, and `site-actions.js`:

```bash
# Validate current directory
npx open-agentic-web validate .

# Validate with machine-readable JSON output (ideal for CI/CD)
npx oaw validate . --json

# Validate multiple agent nodes
npx oaw validate sites/hub sites/mobility sites/ticketing
```

### Validate Federated Mesh
Verify cross-site peer link mappings and compatibility between an orchestrator hub and peer nodes:

```bash
npx oaw federation sites/hub sites/mobility sites/ticketing
# Or in JSON format:
npx oaw federation sites/hub sites/mobility sites/ticketing --json
```

### Local Dev Server & Interactive Playground (`oaw dev`)
Start a zero-dependency local static server preconfigured with correct CORS headers and an interactive in-browser tool test harness:

```bash
# Start local server on port 3000
npx oaw dev sites/tripsteward-hub --port 3000

# Open http://localhost:3000/playground to test site actions and bridge handshakes interactively!
```

### Export A2A Agent Card (`oaw a2a`)
Generate a standard Linux Foundation / Google Agent-to-Agent (A2A) Agent Card (`.well-known/agent.json`) from any conforming node:

```bash
npx oaw a2a sites/tripsteward-hub --out .well-known/agent.json
```

### Scaffold a New Agentic Web Node
Generate a conforming node structure ready to deploy on any static host:

```bash
npx oaw init my-dining-node --name "tablebespoke_dining"
```

Generates:
```text
my-dining-node/
├── agent-manifest.json          # Machine discovery root
├── tablebespoke_dining.network.json # Declarative Neuro SAN agent graph
├── site-actions.js              # Executable JavaScript tools (website_*)
├── bridge/
│   └── action-bridge.html       # Sandboxed cross-origin iframe bridge
├── links.json                   # Peer network resolution map
└── index.html                   # Static landing page
```

---

## 🛠️ 2. Site Actions Framework (`open-agentic-web/actions`)

Define grounded, machine-executable action tools with built-in JSON schema validation, default injection, format/pattern checking, audit logging, and undo support.

```javascript
import { defineAction, createActionRegistry } from "open-agentic-web";

export class SiteActions {
  static registerActions(registry) {
    // 1. Read-only action with schema validation and default value injection
    registry.register(
      defineAction({
        name: "website_search_availability",
        description: "Search open slots by category and party size.",
        effect: "read", // "read" | "irreversible" | "undoable"
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string" },
            party_size: { type: "integer", minimum: 1, default: 2 },
            guest_email: { type: "string", format: "email" }
          },
          required: ["category"],
          additionalProperties: false
        },
        execute: async (args) => {
          return {
            ok: true,
            party_size: args.party_size, // automatically defaulted if omitted
            available_slots: [{ time: "7:00 PM", table: "Patio A" }]
          };
        }
      })
    );

    // 2. Undoable action with dedicated undo handler and audit trail
    registry.register(
      defineAction({
        name: "website_hold_reservation",
        description: "Hold hotel room reservation temporarily.",
        effect: "undoable",
        inputSchema: {
          type: "object",
          properties: { roomId: { type: "string" } },
          required: ["roomId"]
        },
        execute: async (args) => ({ status: "HELD", roomId: args.roomId }),
        undo: async (args, execResult) => ({ status: "RELEASED", roomId: args.roomId })
      })
    );

    // 3. Irreversible action (enforces human confirmation before execution)
    registry.register(
      defineAction({
        name: "website_commit_booking",
        description: "Commit binding reservation with direct provider.",
        effect: "irreversible",
        inputSchema: {
          type: "object",
          properties: {
            slot_id: { type: "string" },
            guest_name: { type: "string" }
          },
          required: ["slot_id", "guest_name"],
          additionalProperties: false
        },
        execute: async (args) => {
          const bookingId = "BOOK-" + Math.floor(1000 + Math.random() * 9000);
          return { ok: true, booking_id: bookingId, status: "CONFIRMED_DIRECT" };
        }
      })
    );
  }
}
```

---

## 🌉 3. Sandboxed Action Bridge (`open-agentic-web/bridge`)

Enable parent orchestrators to execute your site tools from an iframe using the standard `nsdeploy-actions-v1` protocol.

Features **fail-closed security** (defaults to rejecting cross-origin calls unless origin is listed in `peer_policy`), **policy queueing** (eliminates race conditions while `agent-manifest.json` loads), and **pre-execution argument validation**.

### In `bridge/action-bridge.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Action Bridge</title>
    <!-- Browser Import Map for static hosting without bundlers -->
    <script type="importmap">
    {
      "imports": {
        "open-agentic-web": "https://esm.sh/open-agentic-web@1.1.4",
        "open-agentic-web/": "https://esm.sh/open-agentic-web@1.1.4/"
      }
    }
    </script>
    <script type="module">
      import { createActionRegistry, setupActionBridge, createConsentDialog } from "open-agentic-web";
      import { SiteActions } from "../site-actions.js";

      const registry = createActionRegistry();
      SiteActions.registerActions(registry);

      // Listens for postMessage and MessageChannel handshakes from orchestrators
      // Enforces human confirmation dialog for irreversible actions
      setupActionBridge({
        registry,
        manifestUrl: "../agent-manifest.json",
        onConfirm: async ({ action, arguments: args, origin }) => {
          return createConsentDialog({
            title: "Authorize Direct Booking",
            message: `An orchestrator at ${origin} requests permission to execute '${action}'.`,
            details: args
          });
        }
      });
    </script>
  </head>
  <body></body>
</html>
```

### In Orchestrator Client:
```javascript
import { createActionBridgeClient } from "open-agentic-web";

const client = createActionBridgeClient({
  bridgeUrl: "https://partner-site.com/bridge/action-bridge.html",
  brand: "Partner Transfers"
});

// Calls remote site action over sandboxed MessagePort with optional AbortSignal
const quote = await client.execute("website_quote_transfer", {
  destination: "HarborView Hotel",
  flight_number: "UA 482"
}, { signal: abortController.signal });
```

---

## 🌐 4. Dynamic Federation & Provider-Agnostic LLM Runtime (`open-agentic-web/federation`)

Mount third-party agentic web nodes on the fly in browser RAM and execute autonomous agent turns with tool-calling across any LLM provider:

```javascript
import { AgentSwarm } from "open-agentic-web";

const swarm = new AgentSwarm({
  defaultRouter: "https://api.otari.ai/api/v1", // Mozilla Otari, OpenAI, Anthropic, Gemini, Ollama
  defaultModel: "alibaba/qwen3.8-flash"
});

// 1. Mount an external specialist node with interactive user consent & live schema catalog
await swarm.mountFromUrl("https://partner-dining.com", {
  onConsent: async ({ candidate, origin }) => {
    return window.confirm(`Allow agent '${candidate.name}' from ${origin} to join your journey?`);
  }
});

// 2. Search active specialist nodes in the swarm
const diningAgents = swarm.search({ category: "Dining" });

// 3. Execute an autonomous multi-step turn with tool-calling (OpenAI-compatible, Anthropic, or custom adapter)
const turnResult = await swarm.runTurn({
  prompt: "Find a waterfront dinner table for 2 guests around 7 PM",
  apiKey: "otk_my_key", // Visitor's BYOK key
  provider: "openai",   // "openai" (OpenAI-compatible: Otari, OpenRouter, Ollama) | "anthropic" | custom adapter
  signal: abortController.signal, // Supports cancellation
  onStep: ({ step, tool, arguments: args, result }) => {
    console.log(`[Step ${step}] Executed ${tool}:`, result);
  }
});

console.log("Agent response:", turnResult.text);

// 4. Export current peer mappings to links.json format
const linksConfig = swarm.exportLinks("my_hub_network");
```

---

## 📋 API Reference

| Module | Export | Description |
|---|---|---|
| `open-agentic-web/validator` | `validateNode(dir, opts)` | End-to-end conformance validator for an agentic web node |
| `open-agentic-web/validator` | `validateManifest(json)` | Validates `agent-manifest.json` against MVP Profile 0.3 |
| `open-agentic-web/validator` | `validateNetwork(json)` | Validates declarative `*.network.json` graph |
| `open-agentic-web/validator` | `validateFederation(hub, peers)` | Validates multi-site federated mesh and link mappings |
| `open-agentic-web/actions` | `defineAction(def)` | Defines action tool with runtime argument schema validation and undo |
| `open-agentic-web/actions` | `createActionRegistry(opts)` | Manages action registry, discovery catalog, audit trail, and execution |
| `open-agentic-web/actions` | `validateSchema(schema, data)` | Pure-JS JSON schema validator (`pattern`, `format`, `default`, `oneOf`, `anyOf`) |
| `open-agentic-web/actions` | `toA2AAgentCard(manifest, opts)` | Generates standard Linux Foundation / Google A2A Agent Card |
| `open-agentic-web/actions` | `createConsentDialog(opts)` | Drop-in accessible HTML modal dialog for user confirmation |
| `open-agentic-web/bridge` | `setupActionBridge(opts)` | Connects iframe postMessage handler to action registry with fail-closed security |
| `open-agentic-web/bridge` | `createActionBridgeClient(opts)` | Parent orchestrator client for calling remote bridges with `signal` support |
| `open-agentic-web/federation` | `AgentSwarm` | Dynamic multi-agent swarm manager with tool collision safety and provider-agnostic `runTurn()` |

---

## 🛡️ License

Apache-2.0. Built for the Open Agentic Web community.
