# 🌐 Open Agentic Web SDK (`open-agentic-web`)

[![npm version](https://img.shields.io/badge/npm-v1.0.1-blue.svg)](https://www.npmjs.com/package/open-agentic-web)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Specification](https://img.shields.io/badge/Spec-Open%20Agentic%20Web%20MVP%200.3-orange.svg)](https://cognizant-ai-labs.github.io/agentic-web/specs/mvp-v0.3.json)

The **Open Agentic Web SDK** (`open-agentic-web`) is the official developer toolkit, conformance linter, and in-browser runtime for building, validating, and federating autonomous web agents.

Compliant with the **Cognizant AI Lab / Mozilla Otari / MIT NANDA Open Agentic Web (MVP Profile 0.3)** specification.

---

## ⚡ Why `open-agentic-web`?

In the emerging Agentic Web, AI agents don't just chat—they act directly on websites on behalf of users, discovering inventory, holding reservations, and issuing tickets across independent domains without aggregator markups.

Building a conforming agentic website previously required manually writing repetitive boilerplate:
1. **Manifest & Network validation**: No standard CLI existed to verify whether your `agent-manifest.json` or `*.network.json` met the Open Agentic Web specification.
2. **Action tool validation**: Tools called by LLMs (`website_*`) lacked standard runtime JSON schema enforcement and effect classification (`read` vs `irreversible`).
3. **Cross-origin iframe bridging**: Implementing secure postMessage handshakes and MessageChannels for `bridge/action-bridge.html` required hundreds of lines of fragile glue code.
4. **Dynamic Swarm Federation**: No reusable client existed to discover, consent-check, and mount remote agent nodes in browser RAM on the fly.

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

Validate any agentic website or scaffold a brand-new conforming node in seconds.

### Validate Conformance
Run automated checks against `agent-manifest.json`, declarative `*.network.json` graphs, `bridge/action-bridge.html`, and `site-actions.js`:

```bash
# Validate current directory
npx open-agentic-web validate .

# Validate multiple agent nodes
npx oaw validate sites/hub sites/mobility sites/ticketing
```

Output:
```text
✈️ Running Open Agentic Web Conformance Linter

Testing Node: ./sites/tripsteward-hub
  ✅ PASS: Contains 'agent-manifest.json'
  ✅ PASS: Manifest declares valid name or brand ('HarborView Hotel')
  ✅ PASS: Network[0] declares 'front_man' (travel_concierge)
  ✅ PASS: Referenced network file exists: ./tripsteward_concierge.network.json
  ✅ PASS: Manifest declares 'llm_router' with valid 'base_url'
  ✅ PASS: Node provides 'bridge/action-bridge.html' for cross-origin tool execution
  ✅ PASS: Front agent 'travel_concierge' has grounded instructions
  ✅ PASS: site-actions provides registered action tools (7 declared)

All nodes conform 100% to Open Agentic Web MVP Profile 0.3!
```

### Validate Federated Mesh
Verify cross-site peer link mappings and compatibility between an orchestrator hub and peer nodes:

```bash
npx oaw federation sites/hub sites/mobility sites/ticketing
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
└── links.json                   # Peer network resolution map
```

---

## 🛠️ 2. Site Actions Framework (`open-agentic-web/actions`)

Define grounded, machine-executable action tools with built-in JSON schema validation and effect tagging.

```javascript
import { defineAction, createActionRegistry } from "open-agentic-web";

export class SiteActions {
  static registerActions(registry) {
    // 1. Read-only action (safe query, no confirmation needed)
    registry.register(
      defineAction({
        name: "website_search_availability",
        description: "Search open slots by category and party size.",
        effect: "read", // "read" | "irreversible" | "undoable"
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string" },
            party_size: { type: "integer", minimum: 1 }
          },
          required: ["party_size"],
          additionalProperties: false
        },
        execute: async (args) => {
          return {
            ok: true,
            available_slots: [
              { time: "7:00 PM", table: "Patio A" }
            ]
          };
        }
      })
    );

    // 2. Irreversible action (enforces human confirmation before execution)
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
        "open-agentic-web": "https://esm.sh/open-agentic-web@1.0.0",
        "open-agentic-web/": "https://esm.sh/open-agentic-web@1.0.0/"
      }
    }
    </script>
    <script type="module">
      import { createActionRegistry, setupActionBridge } from "open-agentic-web";
      import { SiteActions } from "../site-actions.js";

      const registry = createActionRegistry();
      SiteActions.registerActions(registry);

      // Listens for postMessage and MessageChannel handshakes from orchestrators
      // Enforces human confirmation dialog for irreversible actions
      setupActionBridge({
        registry,
        onConfirm: async ({ action, arguments: args, origin }) => {
          return window.confirm(`Authorize action '${action}' requested by ${origin}?`);
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

// Calls remote site action over sandboxed MessagePort
const quote = await client.execute("website_quote_transfer", {
  destination: "HarborView Hotel",
  flight_number: "UA 482"
});
```

---

## 🌐 4. Dynamic Federation & In-Browser LLM Runtime (`open-agentic-web/federation`)

Mount third-party agentic web nodes on the fly in browser RAM and execute autonomous agent turns with tool-calling:

```javascript
import { AgentSwarm } from "open-agentic-web";

const swarm = new AgentSwarm({
  defaultRouter: "https://api.otari.ai/api/v1",
  defaultModel: "alibaba/qwen3.8-flash"
});

// 1. Mount an external specialist node with interactive user consent
await swarm.mountFromUrl("https://partner-dining.com", {
  onConsent: async ({ candidate, origin }) => {
    return window.confirm(`Allow agent '${candidate.name}' from ${origin} to join your journey?`);
  }
});

// 2. Search active specialist nodes in the swarm
const diningAgents = swarm.search({ category: "Dining" });

// 3. Execute an autonomous multi-step turn with BYOK LLM tool-calling
const turnResult = await swarm.runTurn({
  prompt: "Find a waterfront dinner table for 2 guests around 7 PM",
  apiKey: "otk_my_key", // Visitor's BYOK key
  actionExecutor: async (toolName, args) => {
    return client.execute(toolName, args);
  },
  onStep: ({ step, tool, arguments: args, result }) => {
    console.log(`[Step ${step}] Executed ${tool}:`, result);
  }
});

console.log("Agent response:", turnResult.text);

// 4. Export current peer mappings to links.json format
const linksConfig = swarm.exportLinks("my_hub_network");
});

// Search active specialist nodes in the swarm
const diningAgents = swarm.search({ category: "Dining" });

// Export current peer mappings to links.json format
const linksConfig = swarm.exportLinks("my_hub_network");
```

---

## 📋 API Reference

| Module | Export | Description |
|---|---|---|
| `open-agentic-web/validator` | `validateNode(dir)` | End-to-end conformance validator for an agentic web node |
| `open-agentic-web/validator` | `validateManifest(json)` | Validates `agent-manifest.json` against MVP Profile 0.3 |
| `open-agentic-web/validator` | `validateNetwork(json)` | Validates declarative `*.network.json` graph |
| `open-agentic-web/validator` | `validateFederation(hub, peers)` | Validates multi-site federated mesh and link mappings |
| `open-agentic-web/actions` | `defineAction(def)` | Defines action tool with runtime argument schema validation |
| `open-agentic-web/actions` | `createActionRegistry()` | Manages action registry, discovery catalog, and execution |
| `open-agentic-web/actions` | `validateSchema(schema, data)` | Pure-JS JSON schema validator (zero external deps) |
| `open-agentic-web/bridge` | `setupActionBridge(opts)` | Connects iframe postMessage handler to action registry |
| `open-agentic-web/bridge` | `createActionBridgeClient(opts)` | Parent orchestrator client for calling remote bridges |
| `open-agentic-web/federation` | `AgentSwarm` | Dynamic multi-agent swarm manager with consent hooks |

---

## 🛡️ License

Apache-2.0. Built for the Open Agentic Web community.
