/**
 * Open Agentic Web - Model Context Protocol (MCP) Server
 * Adheres to Model Context Protocol (MCP) JSON-RPC 2.0 Specification.
 * Exposes site actions and conformance audit tools as MCP tools and resources
 * for AI agent hosts (Claude Desktop, Cursor, Antigravity, Gemini CLI).
 *
 * Zero external runtime dependencies.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { createActionRegistry, toA2AAgentCard } from "./actions.js";
import { validateFederation, validateManifest, validateNode } from "./validator.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "open-agentic-web-mcp";
const SERVER_VERSION = "1.2.0";

/**
 * Creates an Open Agentic Web MCP Server instance.
 *
 * @param {Object} options
 * @param {string|string[]} [options.siteDirs] - Site directory or directories to load actions from.
 * @param {Object} [options.registry] - Custom pre-configured ActionRegistry.
 * @param {string} [options.name] - Server name.
 * @param {string} [options.version] - Server version.
 */
export function createMCPServer(options = {}) {
  const serverName = options.name || SERVER_NAME;
  const serverVersion = options.version || SERVER_VERSION;
  const registry = options.registry || createActionRegistry();
  const loadedSites = new Map(); // dirPath -> manifest

  // Built-in OAW tools metadata
  const builtInTools = [
    {
      name: "oaw_validate_node",
      description: "Validate a local directory or remote URL against the Open Agentic Web specification (MVP Profile 0.3). Checks manifests, declarative graphs, peer links, and action contracts.",
      inputSchema: {
        type: "object",
        properties: {
          pathOrUrl: {
            type: "string",
            description: "File path to the site directory or remote URL (e.g., 'sites/tripsteward-hub' or 'http://localhost:8080')"
          }
        },
        required: ["pathOrUrl"]
      }
    },
    {
      name: "oaw_audit_federation",
      description: "Verify cross-site federation mesh integrity, peer link resolution, and agent manifests across a hub and its peer nodes.",
      inputSchema: {
        type: "object",
        properties: {
          hubPath: {
            type: "string",
            description: "Directory path or URL of the hub node (e.g., 'sites/tripsteward-hub')"
          },
          peerPaths: {
            type: "array",
            items: { type: "string" },
            description: "Array of directory paths or URLs of peer nodes"
          }
        },
        required: ["hubPath"]
      }
    },
    {
      name: "oaw_list_actions",
      description: "List all registered action tools, parameter schemas, execution effects (read, irreversible, undoable), and bridge availability.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "oaw_generate_a2a",
      description: "Generate standard Agent-to-Agent (A2A) agent.json card from a site manifest and registered action tools.",
      inputSchema: {
        type: "object",
        properties: {
          siteDir: {
            type: "string",
            description: "Directory path of the site node"
          }
        },
        required: ["siteDir"]
      }
    },
    {
      name: "oaw_inspect_node",
      description: "Inspect an Open Agentic Web node: its declared networks, front agent, router, and registered tools.",
      inputSchema: {
        type: "object",
        properties: {
          siteDir: {
            type: "string",
            description: "Directory path of the site node"
          }
        },
        required: ["siteDir"]
      }
    }
  ];

  /**
   * Load actions from a site directory.
   */
  async function loadSite(siteDir) {
    const absDir = resolve(siteDir);
    const manifestPath = join(absDir, "agent-manifest.json");
    let manifest = null;

    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        loadedSites.set(absDir, manifest);
      } catch (err) {
        console.error(`[MCP] Warning: Failed to parse ${manifestPath}: ${err.message}`);
      }
    }

    const actionsFiles = ["site-actions.js", "site-actions.mjs", "actions.js"];
    for (const af of actionsFiles) {
      const fullPath = join(absDir, af);
      if (existsSync(fullPath)) {
        try {
          const mod = await import(pathToFileURL(fullPath).href);
          if (typeof mod.registerActions === "function") {
            await mod.registerActions(registry);
          } else if (mod.default && typeof mod.default.registerActions === "function") {
            await mod.default.registerActions(registry);
          }
        } catch (err) {
          console.error(`[MCP] Warning: Failed to import ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Get all tools (registered site actions + built-in OAW tools)
   */
  function getTools() {
    const siteTools = registry.toMCPTools();
    return [...builtInTools, ...siteTools];
  }

  /**
   * Execute a tool call
   */
  async function callTool(name, args = {}) {
    // 1. Built-in OAW Tools
    if (name === "oaw_validate_node") {
      const target = args.pathOrUrl;
      const res = await validateNode(target);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              valid: res.valid,
              errors: res.errors,
              manifest: res.manifest ? { name: res.manifest.name, networks: Object.keys(res.manifest.networks || {}) } : null,
              summary: res.valid ? `✅ Valid Open Agentic Web node (${target})` : `❌ Validation failed: ${res.errors.join("; ")}`
            }, null, 2)
          }
        ],
        isError: !res.valid
      };
    }

    if (name === "oaw_audit_federation") {
      const hub = args.hubPath;
      const peers = args.peerPaths || [];
      const res = await validateFederation(hub, peers);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              valid: res.valid,
              errors: res.errors,
              links: res.links,
              summary: res.valid ? `✅ Federated mesh verified (${peers.length} peers)` : `❌ Federation audit failed: ${res.errors.join("; ")}`
            }, null, 2)
          }
        ],
        isError: !res.valid
      };
    }

    if (name === "oaw_list_actions") {
      const actions = registry.list().map(a => ({
        name: a.name,
        description: a.description,
        effect: a.effect || "read",
        availability: a.availability || "local-only",
        inputSchema: a.inputSchema
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: actions.length, actions }, null, 2)
          }
        ],
        isError: false
      };
    }

    if (name === "oaw_generate_a2a") {
      const absDir = resolve(args.siteDir);
      const manifestPath = join(absDir, "agent-manifest.json");
      if (!existsSync(manifestPath)) {
        return {
          content: [{ type: "text", text: `Error: agent-manifest.json not found in ${args.siteDir}` }],
          isError: true
        };
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const card = toA2AAgentCard(manifest, registry);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(card, null, 2)
          }
        ],
        isError: false
      };
    }

    if (name === "oaw_inspect_node") {
      const absDir = resolve(args.siteDir);
      const manifestPath = join(absDir, "agent-manifest.json");
      if (!existsSync(manifestPath)) {
        return {
          content: [{ type: "text", text: `Error: agent-manifest.json not found in ${args.siteDir}` }],
          isError: true
        };
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const networks = {};
      for (const [netName, netConfig] of Object.entries(manifest.networks || {})) {
        const netPath = join(absDir, netConfig.path || `${netName}.network.json`);
        let netContent = null;
        if (existsSync(netPath)) {
          try { netContent = JSON.parse(readFileSync(netPath, "utf-8")); } catch {}
        }
        networks[netName] = {
          front_man: netConfig.front_man,
          path: netConfig.path,
          details: netContent
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: manifest.name,
              description: manifest.description,
              router: manifest.llm_router,
              networks
            }, null, 2)
          }
        ],
        isError: false
      };
    }

    // 2. Site Action Execution
    const action = registry.get(name);
    if (!action) {
      return {
        content: [{ type: "text", text: `Unknown tool: '${name}'` }],
        isError: true
      };
    }

    try {
      const result = await registry.execute(name, args);
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing action '${name}': ${err.message}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * List available MCP resources
   */
  function getResources() {
    const resources = [
      {
        uri: "oaw://audit-log",
        name: "Action Audit Log",
        description: "Chronological log of all executed actions, arguments, timestamps, and effects",
        mimeType: "application/json"
      }
    ];

    for (const [dir, manifest] of loadedSites.entries()) {
      const siteId = basename(dir);
      resources.push({
        uri: `oaw://sites/${siteId}/manifest`,
        name: `${manifest.name || siteId} Manifest`,
        description: `Declarative agent manifest for ${siteId}`,
        mimeType: "application/json"
      });
    }

    return resources;
  }

  /**
   * Read resource content
   */
  function readResource(uri) {
    if (uri === "oaw://audit-log") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(registry.getAuditLog(), null, 2)
          }
        ]
      };
    }

    const siteMatch = uri.match(/^oaw:\/\/sites\/([^/]+)\/manifest$/);
    if (siteMatch) {
      const siteId = siteMatch[1];
      for (const [dir, manifest] of loadedSites.entries()) {
        if (basename(dir) === siteId) {
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(manifest, null, 2)
              }
            ]
          };
        }
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  }

  /**
   * JSON-RPC 2.0 message handler.
   */
  async function handleMessage(msg) {
    if (!msg || typeof msg !== "object") {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request" }
      };
    }

    const { id, method, params } = msg;

    // Handle notifications (no id)
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        // Client initialized notification
        return null;
      }
      return null;
    }

    try {
      switch (method) {
        case "initialize":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false }
              },
              serverInfo: {
                name: serverName,
                version: serverVersion
              }
            }
          };

        case "ping":
          return {
            jsonrpc: "2.0",
            id,
            result: {}
          };

        case "tools/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              tools: getTools()
            }
          };

        case "tools/call": {
          if (!params || !params.name) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "Missing tool name in params" }
            };
          }
          const callResult = await callTool(params.name, params.arguments || {});
          return {
            jsonrpc: "2.0",
            id,
            result: callResult
          };
        }

        case "resources/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              resources: getResources()
            }
          };

        case "resources/read": {
          if (!params || !params.uri) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "Missing uri in params" }
            };
          }
          const res = readResource(params.uri);
          return {
            jsonrpc: "2.0",
            id,
            result: res
          };
        }

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: '${method}'` }
          };
      }
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err.message }
      };
    }
  }

  /**
   * Start listening over stdio JSON-RPC
   */
  function startStdio() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on("line", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed);
        const response = await handleMessage(msg);
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch (err) {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: `Parse error: ${err.message}` }
        }) + "\n");
      }
    });

    return rl;
  }

  // Preload any specified site directories
  const initPromise = (async () => {
    if (options.siteDirs) {
      const dirs = Array.isArray(options.siteDirs) ? options.siteDirs : [options.siteDirs];
      for (const d of dirs) {
        await loadSite(d);
      }
    }
  })();

  return {
    registry,
    loadSite,
    getTools,
    callTool,
    getResources,
    readResource,
    handleMessage,
    startStdio,
    ready: () => initPromise
  };
}
