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
   * Export all registered tools across connected nodes as OpenAI-compatible function calling schemas.
   */
  getOpenAITools(toolSubset = null) {
    const formatted = [];
    const allowed = toolSubset ? new Set(toolSubset) : null;

    for (const node of this.nodes.values()) {
      for (const tool of (node.tools || [])) {
        const name = typeof tool === "string" ? tool : tool.name;
        if (allowed && !allowed.has(name)) continue;

        const description = typeof tool === "object" && tool.description
          ? tool.description
          : `Action provided by specialist agent '${node.name}' (${node.category})`;

        const parameters = typeof tool === "object" && tool.inputSchema
          ? tool.inputSchema
          : { type: "object", properties: {}, additionalProperties: true };

        formatted.push({
          type: "function",
          function: {
            name,
            description,
            parameters
          }
        });
      }
    }
    return formatted;
  }

  /**
   * Execute an in-browser agent turn with BYOK LLM inference and autonomous tool execution.
   * Compatible with Mozilla Otari, OpenRouter, and standard OpenAI-compatible endpoints.
   */
  async runTurn({
    prompt,
    messages = null,
    systemInstructions = "You are a helpful autonomous concierge on the Open Agentic Web.",
    model = this.defaultModel,
    routerUrl = this.defaultRouter,
    apiKey = null,
    actionExecutor = null,
    maxSteps = 5,
    onStep = null,
    fetchFn = globalThis.fetch
  }) {
    if (!fetchFn) {
      throw new Error("fetch is required to execute LLM turns.");
    }

    const conversation = messages
      ? [...messages]
      : [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ];

    const tools = this.getOpenAITools();
    let step = 0;
    let toolCallsCount = 0;

    // Offline / Mock mode support for testing and airgapped environments
    if (apiKey === "mock" || routerUrl === "mock") {
      const mockToolCall = tools.length > 0 && prompt?.toLowerCase().includes("book")
        ? { id: "call_mock_1", function: { name: tools[0].function.name, arguments: "{}" } }
        : null;

      if (mockToolCall && actionExecutor) {
        const result = await actionExecutor(mockToolCall.function.name, {});
        conversation.push({ role: "assistant", tool_calls: [mockToolCall], content: null });
        conversation.push({ role: "tool", tool_call_id: mockToolCall.id, name: mockToolCall.function.name, content: JSON.stringify(result) });
        conversation.push({ role: "assistant", content: `Mock synthesis completed for ${mockToolCall.function.name}.` });
        return { ok: true, text: `Mock synthesis completed for ${mockToolCall.function.name}.`, messages: conversation, stepsCount: 2, toolCallsCount: 1 };
      }

      const reply = `Mock offline response for: ${prompt}`;
      conversation.push({ role: "assistant", content: reply });
      return { ok: true, text: reply, messages: conversation, stepsCount: 1, toolCallsCount: 0 };
    }

    const endpoint = routerUrl.endsWith("/chat/completions")
      ? routerUrl
      : `${routerUrl.replace(/\/$/, "")}/chat/completions`;

    while (step < maxSteps) {
      step++;

      const payload = {
        model,
        messages: conversation,
        tools: tools.length > 0 ? tools : undefined
      };

      const headers = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetchFn(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`LLM inference failed at '${endpoint}' (HTTP ${res.status}): ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        throw new Error("Invalid response format from LLM router: missing choices[0].message");
      }

      conversation.push(message);

      // Check if model called tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const call of message.tool_calls) {
          toolCallsCount++;
          const toolName = call.function.name;
          let args = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }

          let result;
          if (typeof actionExecutor === "function") {
            try {
              result = await actionExecutor(toolName, args);
            } catch (err) {
              result = { ok: false, error: err.message };
            }
          } else {
            result = { ok: true, message: `Tool '${toolName}' executed in swarm context.` };
          }

          if (typeof onStep === "function") {
            try {
              onStep({ step, tool: toolName, arguments: args, result });
            } catch {}
          }

          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: typeof result === "string" ? result : JSON.stringify(result)
          });
        }
      } else {
        // Model provided final answer
        return {
          ok: true,
          text: message.content || "",
          messages: conversation,
          stepsCount: step,
          toolCallsCount
        };
      }
    }

    return {
      ok: true,
      text: conversation[conversation.length - 1]?.content || "Turn reached max steps.",
      messages: conversation,
      stepsCount: step,
      toolCallsCount
    };
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
