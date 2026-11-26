/**
 * Open Agentic Web — Conformance Validator
 * Validates manifests, declarative networks, peer link mappings, and site actions
 * against the Cognizant / Mozilla / MIT NANDA MVP Profile 0.3 specification.
 */

let nodeEnvPromise = null;
async function getNodeEnv() {
  if (!nodeEnvPromise) {
    nodeEnvPromise = (async () => {
      if (typeof process !== "undefined" && process.versions?.node) {
        try {
          const [fs, path, url] = await Promise.all([
            import("node:fs"),
            import("node:path"),
            import("node:url")
          ]);
          return { fs, path, url };
        } catch {
          return null;
        }
      }
      return null;
    })();
  }
  return nodeEnvPromise;
}

export class ConformanceReport {
  constructor(targetName) {
    this.target = targetName;
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.results = [];
  }

  assert(condition, message, { warning = false, details = null } = {}) {
    if (condition) {
      this.passed++;
      this.results.push({ status: "PASS", message, details });
    } else if (warning) {
      this.warnings++;
      this.results.push({ status: "WARN", message, details });
    } else {
      this.failed++;
      this.results.push({ status: "FAIL", message, details });
    }
  }

  toSummary() {
    return {
      target: this.target,
      valid: this.failed === 0,
      total: this.passed + this.failed + this.warnings,
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      results: this.results
    };
  }
}

/**
 * Validates agent-manifest.json
 */
export function validateManifest(manifest, { basePath = "", report = new ConformanceReport("agent-manifest"), fileExistsFn = null } = {}) {
  report.assert(typeof manifest === "object" && manifest !== null, "Manifest must be a valid JSON object");
  if (!manifest || typeof manifest !== "object") return report.toSummary();

  // Basic identification (supports 'name' or 'brand')
  const name = manifest.name || manifest.brand || manifest.networks?.[0]?.name;
  report.assert(typeof name === "string" && name.length > 0, `Manifest declares valid name or brand ('${name || 'missing'}')`);

  // Networks check
  const hasNetworks = Array.isArray(manifest.networks) && manifest.networks.length > 0;
  report.assert(hasNetworks, "Manifest declares at least one network in 'networks' array");

  if (hasNetworks) {
    manifest.networks.forEach((net, i) => {
      report.assert(typeof net.name === "string" && net.name.length > 0, `Network[${i}] has valid 'name' (${net.name || 'unnamed'})`);
      report.assert(typeof net.front_man === "string" && net.front_man.length > 0, `Network[${i}] declares 'front_man' (${net.front_man || 'missing'})`);
      report.assert(typeof net.hocon === "string" && net.hocon.length > 0, `Network[${i}] declares 'hocon' file path (${net.hocon || 'missing'})`);

      if (basePath && typeof net.hocon === "string" && fileExistsFn) {
        report.assert(fileExistsFn(net.hocon), `Referenced network file exists: ${net.hocon}`);
      }
    });
  }

  // LLM Router check
  report.assert(
    manifest.llm_router && typeof manifest.llm_router.base_url === "string",
    "Manifest declares 'llm_router' with valid 'base_url'"
  );

  // Actions check
  if (manifest.actions) {
    report.assert(
      Array.isArray(manifest.actions.agentTools),
      "Manifest 'actions.agentTools' is an array of registered tools"
    );
  }

  // Action Bridge check
  if (basePath && fileExistsFn) {
    report.assert(fileExistsFn("bridge/action-bridge.html"), "Node provides 'bridge/action-bridge.html' for cross-origin tool execution");
  }

  // Peer policy
  if (manifest.peer_policy) {
    const validModes = ["open", "closed"];
    report.assert(
      validModes.includes(manifest.peer_policy.mode),
      `Peer policy mode '${manifest.peer_policy.mode}' is valid ('open' or 'closed')`
    );
    if (manifest.peer_policy.mode === "closed") {
      const allowedPeers = manifest.peer_policy.allowed_peers || manifest.allowed_peers;
      report.assert(
        Array.isArray(allowedPeers) && allowedPeers.length > 0,
        "Closed peer policy must declare 'allowed_peers' (in peer_policy or root)"
      );
    }
  }

  return report.toSummary();
}

/**
 * Validates declarative *.network.json
 */
export function validateNetwork(network, { frontMan = null, report = new ConformanceReport("network") } = {}) {
  report.assert(typeof network === "object" && network !== null, "Network must be a valid JSON object");
  if (!network || typeof network !== "object") return report.toSummary();

  // Tools array
  const hasTools = Array.isArray(network.tools) && network.tools.length > 0;
  report.assert(hasTools, "Network defines 'tools' array");

  // Agents or front agent
  if (Array.isArray(network.agents)) {
    report.addWarning("Top-level 'agents' array detected in network. For full nsdeploy runtime compatibility, define agents directly as objects inside the 'tools' array.");
  }
  const agents = network.agents || network.tools?.filter(t => t.type === "agent" || t.instructions);
  report.assert(Array.isArray(agents) && agents.length > 0, "Network defines at least one agent with instructions");

  if (frontMan && Array.isArray(network.tools)) {
    const agent = network.tools.find(t => t.name === frontMan);
    report.assert(agent !== undefined, `Network defines front agent '${frontMan}'`);
    if (agent) {
      report.assert(
        typeof agent.instructions === "string" && agent.instructions.trim().length >= 30,
        `Front agent '${frontMan}' has grounded instructions (>= 30 chars)`
      );
      const params = agent.function?.parameters || agent.parameters;
      report.assert(
        params && typeof params === "object",
        `Front agent '${frontMan}' declares JSON schema input parameters`
      );
    }
  }

  return report.toSummary();
}

/**
 * Validates links.json
 */
export function validateLinks(links, { report = new ConformanceReport("links") } = {}) {
  report.assert(typeof links === "object" && links !== null, "links.json must be a valid JSON object");
  if (!links || typeof links !== "object") return report.toSummary();

  report.assert(
    links.networks && typeof links.networks === "object",
    "links.json configures 'networks' mapping"
  );

  if (links.networks) {
    const networkNames = Object.keys(links.networks);
    report.assert(networkNames.length > 0, `links.json maps ${networkNames.length} network(s) to peer endpoints`);
  }

  return report.toSummary();
}

/**
 * Validates a site directory for full conformance
 */
export async function validateNode(nodeDir) {
  const env = await getNodeEnv();
  if (!env) {
    throw new Error("validateNode requires a Node.js runtime environment.");
  }
  const { fs, path, url: urlModule } = env;

  const dirPath = path.resolve(nodeDir);
  const report = new ConformanceReport(dirPath);

  report.assert(fs.existsSync(dirPath), `Directory exists: ${dirPath}`);
  if (!fs.existsSync(dirPath)) return report.toSummary();

  const manifestPath = path.join(dirPath, "agent-manifest.json");
  report.assert(fs.existsSync(manifestPath), `Contains 'agent-manifest.json'`);

  if (!fs.existsSync(manifestPath)) return report.toSummary();

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (err) {
    report.assert(false, `agent-manifest.json is valid JSON: ${err.message}`);
    return report.toSummary();
  }

  const fileExistsFn = (relPath) => fs.existsSync(path.resolve(dirPath, relPath));

  // Validate manifest
  validateManifest(manifest, { basePath: dirPath, report, fileExistsFn });

  // Validate referenced networks
  if (Array.isArray(manifest.networks)) {
    for (const net of manifest.networks) {
      if (typeof net.hocon === "string") {
        const netPath = path.resolve(dirPath, net.hocon);
        if (fs.existsSync(netPath)) {
          try {
            const netJson = JSON.parse(fs.readFileSync(netPath, "utf-8"));
            validateNetwork(netJson, { frontMan: net.front_man, report });
          } catch (err) {
            report.assert(false, `Network file '${net.hocon}' is valid JSON: ${err.message}`);
          }
        }
      }
    }
  }

  // Validate links.json if present
  const linksPath = path.join(dirPath, "links.json");
  if (fs.existsSync(linksPath)) {
    try {
      const linksJson = JSON.parse(fs.readFileSync(linksPath, "utf-8"));
      validateLinks(linksJson, { report });
    } catch (err) {
      report.assert(false, `links.json is valid JSON: ${err.message}`);
    }
  }

  // Validate site-actions.js if present
  const actionsPath = path.join(dirPath, "site-actions.js");
  if (fs.existsSync(actionsPath)) {
    try {
      const fileUrl = urlModule.pathToFileURL(actionsPath).href;
      // Provide dummy DOM mock in Node environment if needed
      if (!globalThis.window) {
        globalThis.window = { location: { origin: "http://localhost:8080" } };
      }
      if (!globalThis.document) {
        globalThis.document = { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
      }

      const mod = await import(fileUrl);
      const actionClass = mod.SiteActions || mod.default;
      report.assert(
        actionClass !== undefined,
        "site-actions.js exports SiteActions class or default export"
      );

      if (actionClass) {
        const registeredActions = new Map();
        const mockRegistry = {
          register: (def) => {
            if (Array.isArray(def)) {
              def.forEach(d => mockRegistry.register(d));
              return;
            }
            if (def && def.name) {
              registeredActions.set(def.name, def);
            }
          }
        };

        let registrationOk = false;
        try {
          if (typeof mod.registerActions === "function") {
            await mod.registerActions(mockRegistry);
            registrationOk = true;
          } else if (typeof actionClass.registerActions === "function") {
            await actionClass.registerActions(mockRegistry);
            registrationOk = true;
          } else if (typeof actionClass === "function") {
            const inst = new actionClass();
            if (typeof inst.registerActions === "function") {
              await inst.registerActions(mockRegistry);
              registrationOk = true;
            }
          }
        } catch (err) {
          report.assert(false, `SiteActions.registerActions execution failed: ${err.message}`, { warning: false });
        }

        report.assert(
          typeof mod.registerActions === "function" || typeof actionClass.registerActions === "function",
          `Action module '${actionsPath}' exports registerActions conforming to nsdeploy runtime import contract`
        );

        if (registrationOk) {
          report.assert(
            registeredActions.size > 0,
            `SiteActions.registerActions registered ${registeredActions.size} action tool(s)`
          );

          const manifestTools = manifest.actions?.agentTools || [];
          for (const declaredTool of manifestTools) {
            const baseName = declaredTool.replace(/^website_/, "");
            const hasTool = registeredActions.has(declaredTool) ||
                            registeredActions.has(baseName) ||
                            registeredActions.has(`website_${baseName}`);
            report.assert(
              hasTool,
              `Declared tool '${declaredTool}' is implemented and registered by site-actions.js`
            );

            if (hasTool) {
              const act = registeredActions.get(declaredTool) ||
                          registeredActions.get(baseName) ||
                          registeredActions.get(`website_${baseName}`);
              report.assert(
                typeof act.execute === "function",
                `Tool '${declaredTool}' provides an executable handler`
              );
              report.assert(
                ["read", "write", "irreversible", "undoable"].includes(act.effect),
                `Tool '${declaredTool}' declares valid effect ('${act.effect || 'missing'}')`
              );
              if (act.effect === "undoable") {
                report.addWarning(`Tool '${declaredTool}' uses effect 'undoable'. Cognizant nsdeploy runtime only natively supports 'read' and 'irreversible'.`);
              }
            }
          }
        }
      }
    } catch (err) {
      report.assert(false, `site-actions.js can be inspected: ${err.message}`, { warning: true });
    }
  }

  return report.toSummary();
}

/**
 * Validates cross-site federation between a hub and peer nodes.
 * Verifies links.json mapping, peer_policy permissions, and network/tool alignment.
 */
export async function validateFederation(hubDir, peerDirs = []) {
  const env = await getNodeEnv();
  const { fs, path } = env || {};

  const report = new ConformanceReport("federation-mesh");
  const hubSummary = await validateNode(hubDir);
  const peerSummaries = [];

  let hubManifest = null;
  let hubLinks = null;

  if (fs) {
    try {
      const hubManifestPath = path.join(path.resolve(hubDir), "agent-manifest.json");
      if (fs.existsSync(hubManifestPath)) {
        hubManifest = JSON.parse(fs.readFileSync(hubManifestPath, "utf-8"));
      }
      const hubLinksPath = path.join(path.resolve(hubDir), "links.json");
      if (fs.existsSync(hubLinksPath)) {
        hubLinks = JSON.parse(fs.readFileSync(hubLinksPath, "utf-8"));
      }
    } catch {}
  }

  report.assert(hubLinks !== null, "Hub provides a readable 'links.json' for peer federation");

  // Collect all mapped peer keys/URLs from hub's links.json
  const mappedPeers = new Map();
  if (hubLinks && hubLinks.networks) {
    for (const [netName, peerMap] of Object.entries(hubLinks.networks)) {
      if (typeof peerMap === "object" && peerMap !== null) {
        for (const [peerAlias, endpoint] of Object.entries(peerMap)) {
          mappedPeers.set(peerAlias.toLowerCase(), { networkName: netName, endpoint });
        }
      }
    }
  }

  for (const peerDir of peerDirs) {
    const peerSum = await validateNode(peerDir);
    peerSummaries.push(peerSum);

    if (fs) {
      try {
        const peerManifestPath = path.join(path.resolve(peerDir), "agent-manifest.json");
        if (fs.existsSync(peerManifestPath)) {
          const peerManifest = JSON.parse(fs.readFileSync(peerManifestPath, "utf-8"));
          const peerNetName = peerManifest.networks?.[0]?.name || "";
          const peerBrand = (peerManifest.brand || peerManifest.name || "").toLowerCase();
          const peerDirBase = path.basename(peerDir).toLowerCase().replace(/-(node|site|app)$/, "");

          // 1. Verify hub links.json maps this peer
          const isMapped = mappedPeers.has(peerNetName.toLowerCase()) ||
                           mappedPeers.has(peerBrand) ||
                           mappedPeers.has(peerDirBase) ||
                           Array.from(mappedPeers.keys()).some(k => peerNetName.toLowerCase().includes(k) || peerDirBase.includes(k));

          report.assert(
            isMapped,
            `Hub links.json maps peer network '${peerNetName || peerDirBase}' (${path.basename(peerDir)})`
          );

          // 2. Peer policy permissions check
          if (peerManifest.peer_policy) {
            if (peerManifest.peer_policy.mode === "closed") {
              const allowedPeers = peerManifest.peer_policy.allowed_peers || peerManifest.allowed_peers || [];
              report.assert(
                allowedPeers.length > 0,
                `Peer '${peerNetName || peerDirBase}' declares allowed_peers for closed federation`
              );
            } else {
              report.assert(
                peerManifest.peer_policy.mode === "open",
                `Peer '${peerNetName || peerDirBase}' has open federation mode`
              );
            }
          }

          // 3. Network alignment: peer front_man exists
          const peerFrontMan = peerManifest.networks?.[0]?.front_man;
          report.assert(
            typeof peerFrontMan === "string" && peerFrontMan.length > 0,
            `Peer '${peerNetName || peerDirBase}' declares active front_man '${peerFrontMan}'`
          );
        }
      } catch (err) {
        report.assert(false, `Error reading peer manifest in '${peerDir}': ${err.message}`);
      }
    }
  }

  const allPassed = hubSummary.valid && peerSummaries.every(p => p.valid) && report.failed === 0;

  return {
    valid: allPassed,
    hub: hubSummary,
    peers: peerSummaries,
    meshReport: report.toSummary(),
    totalChecks: hubSummary.total + peerSummaries.reduce((acc, p) => acc + p.total, 0) + report.passed + report.failed,
    totalPassed: hubSummary.passed + peerSummaries.reduce((acc, p) => acc + p.passed, 0) + report.passed,
    totalFailed: hubSummary.failed + peerSummaries.reduce((acc, p) => acc + p.failed, 0) + report.failed
  };
}
