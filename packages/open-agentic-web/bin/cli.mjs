#!/usr/bin/env node

/**
 * Open Agentic Web CLI (oaw / open-agentic-web)
 * Validates, scaffolds, and inspects conforming Agentic Web nodes.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createActionRegistry, toA2AAgentCard } from "../src/actions.js";
import { validateFederation, validateManifest, validateNetwork, validateNode } from "../src/validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let VERSION = "1.1.3";
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
  if (pkg.version) VERSION = pkg.version;
} catch {}

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
  ${colors.cyan}validate${colors.reset} [paths...]       Validate one or more site directories or URLs (--json for CI).
  ${colors.cyan}federation${colors.reset} <hub> [peers...] Validate cross-site federation, peer links, and manifests (--json for CI).
  ${colors.cyan}dev${colors.reset} [dir] [--port 3000]   Start local development server with CORS & interactive playground.
  ${colors.cyan}init${colors.reset} [dir]                Scaffold a new, 100% conforming Open Agentic Web node.
  ${colors.cyan}inspect${colors.reset} [path]             Inspect and print the declarative agent graph and tool catalog.
  ${colors.cyan}a2a${colors.reset} [dir] [--out path]    Generate standard Agent-to-Agent (A2A) agent.json card.
  ${colors.cyan}help${colors.reset}                    Display this help message.
  ${colors.cyan}version${colors.reset}                 Print current package version.

${colors.bold}EXAMPLES:${colors.reset}
  $ npx open-agentic-web validate .
  $ npx oaw validate sites/tripsteward-hub sites/cityglide-node --json
  $ npx oaw federation sites/tripsteward-hub sites/cityglide-node sites/metropass-node
  $ npx oaw dev sites/cityglide-node --port 8081
  $ npx oaw a2a sites/tripsteward-hub
  $ npx oaw init my-dining-node --name "tablebespoke_dining"
`);
}

async function validateRemoteUrl(urlStr) {
  const cleanUrl = urlStr.replace(/\/$/, "");
  const results = [];
  let failed = 0;

  try {
    const manifestUrl = `${cleanUrl}/agent-manifest.json`;
    const manifestRes = await fetch(manifestUrl);

    // Check CORS
    const corsHeader = manifestRes.headers.get("access-control-allow-origin");
    if (corsHeader === "*" || corsHeader) {
      results.push({ status: "PASS", message: `CORS header present on manifest: 'Access-Control-Allow-Origin: ${corsHeader}'` });
    } else {
      results.push({ status: "WARN", message: `Missing 'Access-Control-Allow-Origin' header on ${manifestUrl}. Remote browser swarms may be blocked by CORS.` });
    }

    if (!manifestRes.ok) {
      results.push({ status: "FAIL", message: `Failed to fetch agent-manifest.json from '${manifestUrl}' (HTTP ${manifestRes.status})` });
      failed++;
      return { target: cleanUrl, valid: false, failed, results };
    }

    results.push({ status: "PASS", message: `Successfully fetched 'agent-manifest.json'` });
    const manifest = await manifestRes.json();
    const manifestCheck = validateManifest(manifest);
    results.push(...manifestCheck.results);
    if (!manifestCheck.valid) failed += manifestCheck.failed;

    // Check bridge
    const bridgeUrl = `${cleanUrl}/bridge/action-bridge.html`;
    try {
      const bridgeRes = await fetch(bridgeUrl);
      if (bridgeRes.ok) {
        results.push({ status: "PASS", message: `Live action bridge available at '${bridgeUrl}'` });
        const xfo = bridgeRes.headers.get("x-frame-options");
        if (xfo && (xfo.toUpperCase() === "DENY" || xfo.toUpperCase() === "SAMEORIGIN")) {
          results.push({ status: "FAIL", message: `Action bridge has 'X-Frame-Options: ${xfo}' which prevents cross-origin embedding by orchestrators!` });
          failed++;
        } else {
          results.push({ status: "PASS", message: `X-Frame-Options allows cross-origin embedding` });
        }
      } else {
        results.push({ status: "WARN", message: `Action bridge at '${bridgeUrl}' returned HTTP ${bridgeRes.status}` });
      }
    } catch (e) {
      results.push({ status: "WARN", message: `Could not verify action bridge at '${bridgeUrl}': ${e.message}` });
    }

    // Check declarative network if declared
    const netPath = manifest.networks?.[0]?.hocon;
    if (netPath && typeof netPath === "string") {
      const networkUrl = `${cleanUrl}/${netPath.replace(/^\.\//, "")}`;
      try {
        const netRes = await fetch(networkUrl);
        if (netRes.ok) {
          results.push({ status: "PASS", message: `Fetched declarative network from '${networkUrl}'` });
          const netJson = await netRes.json();
          const netCheck = validateNetwork(netJson);
          results.push(...netCheck.results);
          if (!netCheck.valid) failed += netCheck.failed;
        } else {
          results.push({ status: "FAIL", message: `Referenced network file at '${networkUrl}' returned HTTP ${netRes.status}` });
          failed++;
        }
      } catch (e) {
        results.push({ status: "FAIL", message: `Failed to fetch network graph from '${networkUrl}': ${e.message}` });
        failed++;
      }
    }
  } catch (err) {
    results.push({ status: "FAIL", message: `Network error connecting to '${cleanUrl}': ${err.message}` });
    failed++;
  }

  return {
    target: cleanUrl,
    valid: failed === 0,
    failed,
    results
  };
}

async function runValidate() {
  const isJson = args.includes("--json");
  const rawTargets = args.slice(1).filter(a => a !== "--json");
  const targetDirs = rawTargets.length > 0 ? rawTargets : ["."];
  let overallFailed = 0;
  const reports = [];

  if (!isJson) {
    console.log(`\n${colors.bold}✈️  Running Open Agentic Web Conformance Linter${colors.reset}\n`);
  }

  for (const dir of targetDirs) {
    const isRemote = dir.startsWith("http://") || dir.startsWith("https://");
    const summary = isRemote ? await validateRemoteUrl(dir) : await validateNode(dir);
    reports.push(summary);

    if (!isJson) {
      console.log(`${colors.bold}Testing ${isRemote ? "Live Node" : "Node"}:${colors.reset} ${colors.cyan}${summary.target}${colors.reset}`);

      summary.results.forEach(res => {
        if (res.status === "PASS") {
          console.log(`  ${colors.green}✅ PASS:${colors.reset} ${res.message}`);
        } else if (res.status === "WARN") {
          console.log(`  ${colors.yellow}⚠️ WARN:${colors.reset} ${res.message}`);
        } else {
          console.log(`  ${colors.red}❌ FAIL:${colors.reset} ${res.message}`);
        }
      });
      console.log("");
    }

    if (!summary.valid) {
      overallFailed += summary.failed;
    }
  }

  if (isJson) {
    console.log(JSON.stringify({ valid: overallFailed === 0, failed: overallFailed, reports }, null, 2));
    process.exit(overallFailed > 0 ? 1 : 0);
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
  const isJson = args.includes("--json");
  const paths = args.slice(1).filter(a => a !== "--json");
  if (paths.length < 1) {
    if (isJson) {
      console.log(JSON.stringify({ valid: false, error: "'federation' requires at least a hub directory." }, null, 2));
    } else {
      console.error(`${colors.red}Error: 'federation' requires at least a hub directory.${colors.reset}`);
    }
    process.exit(1);
  }

  const hubDir = paths[0];
  const peerDirs = paths.slice(1);

  if (!isJson) {
    console.log(`\n${colors.bold}🌐 Validating Federated Mesh:${colors.reset} Hub (${hubDir}) + ${peerDirs.length} peer(s)\n`);
  }
  const fed = await validateFederation(hubDir, peerDirs);

  if (isJson) {
    console.log(JSON.stringify(fed, null, 2));
    process.exit(fed.valid ? 0 : 1);
  }

  console.log(`Total checks run: ${fed.totalChecks}`);
  console.log(`Passed: ${colors.green}${fed.totalPassed}${colors.reset} | Failed: ${colors.red}${fed.totalFailed}${colors.reset}`);

  if (fed.meshReport?.results && fed.meshReport.results.length > 0) {
    console.log(`\n${colors.bold}Mesh Link & Policy Verification Details:${colors.reset}`);
    fed.meshReport.results.forEach(res => {
      if (res.status === "PASS") {
        console.log(`  ${colors.green}✅ PASS:${colors.reset} ${res.message}`);
      } else {
        console.log(`  ${colors.red}❌ FAIL:${colors.reset} ${res.message}`);
      }
    });
  }

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
        `query_inventory`,
        `commit_reservation`
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

export function registerActions(registry) {
  return SiteActions.registerActions(registry);
}

export class SiteActions {
  static registerActions(registry) {
    registry.register(
      defineAction({
        name: "query_inventory",
        description: "Check live provider availability with zero middleman markup.",
        effect: "read",
        availability: "bridge",
        callerOrigins: ["*"],
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
        name: "commit_reservation",
        description: "Confirm and commit a direct provider reservation.",
        effect: "irreversible",
        availability: "bridge",
        callerOrigins: ["*"],
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
        "open-agentic-web": "https://esm.sh/open-agentic-web@${VERSION}",
        "open-agentic-web/": "https://esm.sh/open-agentic-web@${VERSION}/"
      }
    }
    </script>
    <script type="module">
      import { createActionRegistry, setupActionBridge } from "open-agentic-web";
      import { SiteActions } from "../site-actions.js";

      const registry = createActionRegistry();
      SiteActions.registerActions(registry);

      // Secure action bridge: allows cross-origin orchestrators while enforcing human confirmation for irreversible actions
      setupActionBridge({
        registry,
        allowedOrigins: ["*"],
        onConfirm: async ({ action, arguments: args, origin }) => {
          return window.confirm("[Action Authorization] " + origin + " is requesting to execute '" + action + "'. Authorize this action?");
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
        "open-agentic-web": "https://esm.sh/open-agentic-web@${VERSION}",
        "open-agentic-web/": "https://esm.sh/open-agentic-web@${VERSION}/"
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

  // 6. links.json
  const links = {
    networks: {
      [`${nodeName}_network`]: {}
    }
  };
  writeFileSync(join(fullPath, "links.json"), JSON.stringify(links, null, 2));

  console.log(`\n${colors.green}${colors.bold}✨ Scaffolding complete!${colors.reset}`);
  console.log(`Created conforming Open Agentic Web node at: ${colors.cyan}${fullPath}${colors.reset}`);
  console.log(`Files generated:
  ├── index.html
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

function runDev() {
  const portIndex = args.indexOf("--port");
  const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : 3000;
  const nonFlagArgs = args.slice(1).filter(a => a !== "--port" && a !== String(port));
  const targetDir = resolve(nonFlagArgs[0] || ".");

  if (!existsSync(targetDir)) {
    console.error(`${colors.red}Directory not found: ${targetDir}${colors.reset}`);
    process.exit(1);
  }

  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };

  const server = createServer((req, res) => {
    // Enable CORS and embedding for local agentic web testing
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlPath = req.url.split("?")[0];
    const safeTargetDir = resolve(targetDir);
    const candidatePath = urlPath === "/" ? "index.html" : (urlPath.startsWith("/") ? urlPath.slice(1) : urlPath);
    let filePath = resolve(safeTargetDir, candidatePath);

    if (!filePath.startsWith(safeTargetDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("403 Forbidden: Path traversal detected.");
      return;
    }

    if (urlPath === "/playground") {
      // Interactive browser test harness
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Open Agentic Web — Local Test Harness</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.5; color: #1e293b; }
    h1 { color: #0284c7; }
    pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow: auto; }
    button { padding: 8px 16px; border-radius: 6px; background: #0284c7; color: white; border: none; cursor: pointer; font-weight: 500; }
    input { padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; width: 60%; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>🌐 Open Agentic Web Local Test Playground</h1>
  <p>Local Node: <code>${basename(targetDir)}</code> (Port ${port})</p>
  <div class="card">
    <h3>1. Action Bridge Status</h3>
    <iframe id="bridgeFrame" src="/bridge/action-bridge.html" style="width: 100%; height: 80px; border: 1px dashed #cbd5e1; border-radius: 6px;"></iframe>
  </div>
  <div class="card">
    <h3>2. Test Site Action Invocation</h3>
    <p>Call an action through the sandboxed postMessage iframe bridge:</p>
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <input id="actionName" placeholder="e.g. website_query_inventory" value="website_query_inventory">
      <button id="callBtn">Execute Action</button>
    </div>
    <h4>Result:</h4>
    <pre id="output">Click 'Execute Action' to test handshake and execution...</pre>
  </div>
  <script type="module">
    import { createActionBridgeClient } from "https://esm.sh/open-agentic-web@${VERSION}";
    const client = createActionBridgeClient({ bridgeUrl: "/bridge/action-bridge.html" });
    document.getElementById("callBtn").addEventListener("click", async () => {
      const name = document.getElementById("actionName").value.trim();
      const output = document.getElementById("output");
      output.textContent = "Executing " + name + "...";
      try {
        const res = await client.execute(name, {});
        output.textContent = JSON.stringify(res, null, 2);
      } catch (err) {
        output.textContent = "Error: " + err.message;
      }
    });
  </script>
</body>
</html>`);
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
      const ext = extname(filePath);
      const contentType = mimeTypes[ext] || "text/plain";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    }
  });

  server.listen(port, () => {
    console.log(`\n${colors.bold}${colors.green}🚀 Open Agentic Web Dev Server running!${colors.reset}`);
    console.log(`Serving node: ${colors.cyan}${targetDir}${colors.reset}`);
    console.log(`Local URL:    ${colors.bold}http://localhost:${port}/${colors.reset}`);
    console.log(`Playground:   ${colors.cyan}http://localhost:${port}/playground${colors.reset}`);
    console.log(`Bridge URL:   http://localhost:${port}/bridge/action-bridge.html`);
    console.log(`Manifest URL: http://localhost:${port}/agent-manifest.json\n`);
  });
}

async function runA2A() {
  const nonFlagArgs = args.slice(1).filter(a => a !== "--out" && !a.startsWith("http"));
  const targetDir = resolve(nonFlagArgs[0] || ".");
  const outIndex = args.indexOf("--out");
  const outPath = outIndex !== -1 && args[outIndex + 1] ? resolve(args[outIndex + 1]) : null;

  const manifestPath = join(targetDir, "agent-manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`${colors.red}Error: No 'agent-manifest.json' found at ${targetDir}${colors.reset}`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  // Hydrate action schemas and effects from site-actions if available
  let registry = null;
  const actionsRelPath = manifest.actions?.module || "./site-actions.js";
  const actionsPath = join(targetDir, actionsRelPath);
  if (existsSync(actionsPath)) {
    try {
      const actionsUrl = pathToFileURL(actionsPath).href;
      const actionsModule = await import(actionsUrl);
      registry = createActionRegistry();
      if (typeof actionsModule.registerActions === "function") {
        await actionsModule.registerActions(registry);
      } else if (actionsModule.SiteActions && typeof actionsModule.SiteActions.registerActions === "function") {
        await actionsModule.SiteActions.registerActions(registry);
      }
    } catch {
      // Continue with manifest fallback
    }
  }

  const card = toA2AAgentCard(manifest, { registry });
  const jsonStr = JSON.stringify(card, null, 2);

  if (outPath) {
    writeFileSync(outPath, jsonStr, "utf-8");
    console.log(`${colors.green}Generated A2A Agent Card written to:${colors.reset} ${outPath}`);
  } else {
    console.log(jsonStr);
  }
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
  case "dev":
  case "serve":
  case "playground":
    runDev();
    break;
  case "a2a":
  case "card":
    runA2A();
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
    console.log(`open-agentic-web v${VERSION}`);
    break;
  case "help":
  case "--help":
  default:
    printHelp();
    break;
}
