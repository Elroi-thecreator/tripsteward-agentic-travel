#!/usr/bin/env node

/**
 * Open Agentic Web CLI (oaw / open-agentic-web)
 * Validates, scaffolds, and inspects conforming Agentic Web nodes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { validateFederation, validateNode } from "../src/validator.js";

const args = process.argv.slice(2);
const command = args[0] || "help";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m"
};

function printHelp() {
  console.log(`
${colors.bold}${colors.cyan}🌐 Open Agentic Web CLI${colors.reset} — Conformance Linter & Developer Toolkit
Spec: Cognizant / Mozilla / MIT NANDA MVP Profile 0.3

${colors.bold}USAGE:${colors.reset}
  $ open-agentic-web <command> [options]
  $ oaw <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.cyan}validate${colors.reset} [paths...]       Validate one or more site directories for specification conformance.
  ${colors.cyan}federation${colors.reset} <hub> [peers...] Validate cross-site federation, peer links, and manifests.
  ${colors.cyan}init${colors.reset} [dir]                Scaffold a new, 100% conforming Open Agentic Web node.
  ${colors.cyan}inspect${colors.reset} [path]             Inspect and print the declarative agent graph and tool catalog.
  ${colors.cyan}help${colors.reset}                    Display this help message.
  ${colors.cyan}version${colors.reset}                 Print current package version.

${colors.bold}EXAMPLES:${colors.reset}
  $ npx open-agentic-web validate .
  $ npx oaw validate sites/tripsteward-hub sites/cityglide-node
  $ npx oaw federation sites/tripsteward-hub sites/cityglide-node sites/metropass-node
  $ npx oaw init my-dining-node --name "tablebespoke_dining"
`);
}

async function runValidate() {
  const targetDirs = args.slice(1).length > 0 ? args.slice(1) : ["."];
  let overallFailed = 0;

  console.log(`\n${colors.bold}✈️  Running Open Agentic Web Conformance Linter${colors.reset}\n`);

  for (const dir of targetDirs) {
    const summary = await validateNode(dir);
    console.log(`${colors.bold}Testing Node:${colors.reset} ${colors.cyan}${summary.target}${colors.reset}`);

    summary.results.forEach(res => {
      if (res.status === "PASS") {
        console.log(`  ${colors.green}✅ PASS:${colors.reset} ${res.message}`);
      } else if (res.status === "WARN") {
        console.log(`  ${colors.yellow}⚠️ WARN:${colors.reset} ${res.message}`);
      } else {
        console.log(`  ${colors.red}❌ FAIL:${colors.reset} ${res.message}`);
      }
    });

    if (!summary.valid) {
      overallFailed += summary.failed;
    }
    console.log("");
  }

  if (overallFailed > 0) {
    console.error(`${colors.red}${colors.bold}Validation failed with ${overallFailed} error(s).${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}All nodes conform 100% to Open Agentic Web MVP Profile 0.3!${colors.reset}\n`);
    process.exit(0);
  }
}

async function runFederation() {
  const paths = args.slice(1);
  if (paths.length < 1) {
    console.error(`${colors.red}Error: 'federation' requires at least a hub directory.${colors.reset}`);
    process.exit(1);
  }

  const hubDir = paths[0];
  const peerDirs = paths.slice(1);

  console.log(`\n${colors.bold}🌐 Validating Federated Mesh:${colors.reset} Hub (${hubDir}) + ${peerDirs.length} peer(s)\n`);
  const fed = await validateFederation(hubDir, peerDirs);

  console.log(`Total checks run: ${fed.totalChecks}`);
  console.log(`Passed: ${colors.green}${fed.totalPassed}${colors.reset} | Failed: ${colors.red}${fed.totalFailed}${colors.reset}`);

  if (!fed.valid) {
    console.error(`\n${colors.red}${colors.bold}Federation validation failed.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}Federation verified successfully!${colors.reset}\n`);
    process.exit(0);
  }
}

function runInit() {
  const targetDir = args[1] || "my-agentic-node";
  const nameIndex = args.indexOf("--name");
  const nodeName = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : basename(targetDir);

  const fullPath = resolve(targetDir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }

  const bridgeDir = join(fullPath, "bridge");
  if (!existsSync(bridgeDir)) {
    mkdirSync(bridgeDir, { recursive: true });
  }

  // 1. agent-manifest.json
  const manifest = {
    specification: "https://cognizant-ai-labs.github.io/agentic-web/specs/mvp-v0.3.json",
    name: nodeName,
    version: "1.0.0",
    description: `${nodeName}: Conforming Open Agentic Web Specialist Node`,
    networks: [
      {
        name: `${nodeName}_network`,
        hocon: `./${nodeName}.network.json`,
        front_man: "specialist_concierge"
      }
    ],
    llm_router: {
      base_url: "https://api.otari.ai/api/v1",
      default_model: "alibaba/qwen3.8-flash"
    },
    actions: {
      agentTools: [
        `website_query_inventory`,
        `website_commit_reservation`
      ]
    },
    peer_policy: {
      mode: "open"
    }
  };
  writeFileSync(join(fullPath, "agent-manifest.json"), JSON.stringify(manifest, null, 2));

  // 2. <nodeName>.network.json
  const network = {
    tools: [
      {
        name: "specialist_concierge",
        role: "Specialist Provider Concierge",
        instructions: `You are the ${nodeName} autonomous agent concierge. Inspect open inventory using website_query_inventory, and once the traveler approves, secure the booking directly via website_commit_reservation.`,
        function: {
          parameters: {
            type: "object",
            properties: {
              request: { type: "string" }
            },
            required: ["request"]
          }
        }
      }
    ]
  };
  writeFileSync(join(fullPath, `${nodeName}.network.json`), JSON.stringify(network, null, 2));

  // 3. site-actions.js
  const actionsJs = `// Grounded executable site actions for ${nodeName}
import { defineAction, createActionRegistry } from "open-agentic-web";

export class SiteActions {
  static registerActions(registry) {
    registry.register(
      defineAction({
        name: "website_query_inventory",
        description: "Check live provider availability with zero middleman markup.",
        effect: "read",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string" }
          }
        },
        execute: async (args) => {
          return { ok: true, available: true, items: [] };
        }
      })
    );

    registry.register(
      defineAction({
        name: "website_commit_reservation",
        description: "Confirm and commit a direct provider reservation.",
        effect: "irreversible",
        inputSchema: {
          type: "object",
          properties: {
            item_id: { type: "string" }
          },
          required: ["item_id"]
        },
        execute: async (args) => {
          return { ok: true, booking_id: "RES-" + Math.floor(1000 + Math.random() * 9000), status: "CONFIRMED" };
        }
      })
    );
  }
}
`;
  writeFileSync(join(fullPath, "site-actions.js"), actionsJs);

  // 4. bridge/action-bridge.html
  const bridgeHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Action Bridge - ${nodeName}</title>
    <!-- Browser Import Map: Resolves bare module specifiers on static hosts without a bundler -->
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

      // Secure action bridge with human confirmation for irreversible actions
      setupActionBridge({
        registry,
        onConfirm: async ({ action, arguments: args, origin }) => {
          return window.confirm(\`[Action Authorization] \${origin} is requesting to execute '\${action}'. Authorize this action?\`);
        }
      });
    </script>
  </head>
  <body>
    <h3>Action Bridge for ${nodeName}</h3>
  </body>
</html>
`;
  writeFileSync(join(bridgeDir, "action-bridge.html"), bridgeHtml);

  // 5. index.html presentation starter
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${nodeName} - Open Agentic Web Node</title>
    <script type="importmap">
    {
      "imports": {
        "open-agentic-web": "https://esm.sh/open-agentic-web@1.0.0",
        "open-agentic-web/": "https://esm.sh/open-agentic-web@1.0.0/"
      }
    }
    </script>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; line-height: 1.5;">
    <h1>🌐 ${nodeName}</h1>
    <p>This is a conforming <strong>Open Agentic Web (MVP Profile 0.3)</strong> node.</p>
    <ul>
      <li>Machine Manifest: <code><a href="./agent-manifest.json">agent-manifest.json</a></code></li>
      <li>Declarative Network: <code><a href="./${nodeName}.network.json">${nodeName}.network.json</a></code></li>
      <li>Action Bridge: <code><a href="./bridge/action-bridge.html">bridge/action-bridge.html</a></code></li>
    </ul>
  </body>
</html>
`;
  writeFileSync(join(fullPath, "index.html"), indexHtml);

  // 5. links.json
  const links = {
    networks: {
      [`${nodeName}_network`]: {}
    }
  };
  writeFileSync(join(fullPath, "links.json"), JSON.stringify(links, null, 2));

  console.log(`\n${colors.green}${colors.bold}✨ Scaffolding complete!${colors.reset}`);
  console.log(`Created conforming Open Agentic Web node at: ${colors.cyan}${fullPath}${colors.reset}`);
  console.log(`Files generated:
  ├── agent-manifest.json
  ├── ${nodeName}.network.json
  ├── site-actions.js
  ├── bridge/action-bridge.html
  └── links.json\n`);
  console.log(`Verify conformance with: ${colors.cyan}npx open-agentic-web validate ${targetDir}${colors.reset}\n`);
}

async function runInspect() {
  const targetDir = args[1] || ".";
  const manifestPath = join(resolve(targetDir), "agent-manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`${colors.red}Error: No 'agent-manifest.json' found at ${targetDir}${colors.reset}`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  console.log(`\n${colors.bold}🔍 Agentic Node Inspection: ${manifest.name}${colors.reset}`);
  console.log(`Description: ${manifest.description || "N/A"}`);
  console.log(`Specification: ${manifest.specification || "N/A"}`);
  console.log(`LLM Router: ${manifest.llm_router?.base_url || "N/A"} (${manifest.llm_router?.default_model || "N/A"})`);
  console.log(`Registered Agent Tools (${manifest.actions?.agentTools?.length || 0}):`);
  manifest.actions?.agentTools?.forEach(t => console.log(`  • ${colors.cyan}${t}${colors.reset}`));
  console.log("");
}

switch (command) {
  case "validate":
  case "test":
  case "check":
    runValidate();
    break;
  case "federation":
    runFederation();
    break;
  case "init":
  case "scaffold":
  case "new":
    runInit();
    break;
  case "inspect":
    runInspect();
    break;
  case "version":
  case "-v":
  case "--version":
    console.log("open-agentic-web v1.0.0");
    break;
  case "help":
  case "--help":
  default:
    printHelp();
    break;
}
