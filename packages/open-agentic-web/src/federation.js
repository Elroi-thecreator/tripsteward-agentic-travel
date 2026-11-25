/**
 * Open Agentic Web — Dynamic Swarm & Federation Engine
 * Handles in-browser discovery, permission-checked mounting, and unmounting
 * of peer agentic web nodes on the fly with 100% client-side privacy.
 */

export class AgentSwarm {
  constructor({ defaultRouter = "https://api.otari.ai/api/v1", defaultModel = "alibaba/qwen3.8-flash" } = {}) {
    this.defaultRouter = defaultRouter;
    this.defaultModel = defaultModel;
    this.nodes = new Map();
    this.listeners = new Set();
  }

  /**
   * Register a new agentic node into the active swarm.
   */
  registerNode(node) {
    if (!node || !node.id) {
      throw new Error("Node configuration must declare a unique 'id'.");
    }

    const normalizedNode = {
      id: node.id,
      name: node.name || node.id,
      category: node.category || "General",
      front_man: node.front_man || "agent",
      node_url: node.node_url || "",
      tools: Array.isArray(node.tools) ? node.tools : [],
      icon: node.icon || "🌐",
      description: node.description || "",
      connectedAt: Date.now(),
      status: "connected",
      ...node
    };

    this.nodes.set(normalizedNode.id, normalizedNode);
    this._notify();
    return normalizedNode;
  }

  /**
   * Unregister / unlink an agent node from the swarm.
   */
  unregisterNode(id) {
    const existed = this.nodes.delete(id);
    if (existed) this._notify();
    return existed;
  }

  /**
   * Search connected or catalog nodes by keyword or category.
   */
  search({ query = "", category = "all" } = {}) {
    const q = query.trim().toLowerCase();
    const cat = category.trim().toLowerCase();

    return Array.from(this.nodes.values()).filter(node => {
      const matchCat = !cat || cat === "all" || node.category.toLowerCase() === cat;
      const matchQuery = !q ||
        node.name.toLowerCase().includes(q) ||
        node.description.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q) ||
        node.tools.some(t => t.toLowerCase().includes(q));

      return matchCat && matchQuery;
    });
  }

  /**
   * Get all registered nodes.
   */
  getNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Export dynamic links.json structure.
   */
  exportLinks(hubNetworkName = "hub_orchestrator") {
    const links = {
      networks: {
        [hubNetworkName]: {}
      }
    };

    for (const [id, node] of this.nodes.entries()) {
      links.networks[hubNetworkName][id] = node.node_url;
    }

    return links;
  }

  /**
   * Mount a remote conforming agentic web node from its public URL.
   * If onConsent hook is provided, requests user approval before registering.
   */
  async mountFromUrl(nodeUrl, { onConsent = null, fetchFn = globalThis.fetch } = {}) {
    if (!fetchFn) {
      throw new Error("fetch is required to mount remote agentic web nodes.");
    }

    const cleanUrl = nodeUrl.replace(/\/$/, "");
    const manifestEndpoint = cleanUrl.endsWith(".json")
      ? cleanUrl
      : `${cleanUrl}/agent-manifest.json`;

    const response = await fetchFn(manifestEndpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest from '${manifestEndpoint}' (HTTP ${response.status})`);
    }

    const manifest = await response.json();
    const network = manifest.networks?.[0];
    if (!network) {
      throw new Error(`Manifest at '${manifestEndpoint}' does not declare any networks.`);
    }

    const candidateNode = {
      id: manifest.name || network.name || `node_${Date.now()}`,
      name: manifest.brand || manifest.description || manifest.name || network.name,
      front_man: network.front_man,
      node_url: cleanUrl,
      category: manifest.category || (network.tags && network.tags[0]) || "Specialist",
      description: manifest.description || network.description || "",
      tools: manifest.actions?.agentTools || []
    };

    // User consent check
    if (typeof onConsent === "function") {
      const approved = await onConsent({
        candidate: candidateNode,
        manifest,
        origin: new URL(cleanUrl).origin
      });

      if (!approved) {
        throw new Error(`Mounting of node '${candidateNode.name}' was declined by user consent.`);
      }
    }

    return this.registerNode(candidateNode);
  }

  /**
   * Subscribe to swarm changes.
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    const nodes = this.getNodes();
    for (const cb of this.listeners) {
      try { cb(nodes); } catch (e) { console.error("Swarm listener error:", e); }
    }
  }
}
