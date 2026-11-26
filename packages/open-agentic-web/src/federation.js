/**
 * Open Agentic Web — Dynamic Swarm & Federation Engine
 * Handles in-browser discovery, permission-checked mounting, and unmounting
 * of peer agentic web nodes on the fly with 100% client-side privacy.
 */

import { createActionBridgeClient } from "./bridge.js";
import { validateSchema } from "./actions.js";

export class AgentSwarm {
  constructor({ defaultRouter = "https://api.otari.ai/api/v1", defaultModel = "alibaba/qwen3.8-flash" } = {}) {
    this.defaultRouter = defaultRouter;
    this.defaultModel = defaultModel;
    this.nodes = new Map();
    this.listeners = new Set();
    this._toolMap = new Map();
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
        node.tools.some(t =>
          (typeof t === "string" ? t : `${t?.name || ""} ${t?.description || ""}`)
            .toLowerCase()
            .includes(q)
        );

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
   * Get a registered node by ID.
   */
  getNode(id) {
    return this.nodes.get(id);
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
   * In browser contexts, optionally auto-wires an ActionBridgeClient and hydrates live catalog.
   */
  async mountFromUrl(nodeUrl, { onConsent = null, autoWireBridge = true, fetchFn = globalThis.fetch } = {}) {
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

    let hydratedTools = manifest.actions?.agentTools || [];
    if (network && typeof network.hocon === "string") {
      try {
        const netPath = network.hocon.replace(/^\.\//, "");
        const netUrl = `${cleanUrl}/${netPath}`;
        const netRes = await fetchFn(netUrl);
        if (netRes && netRes.ok) {
          const netJson = await netRes.json();
          const declaredTools = netJson.tools || [];
          const toolDefs = new Map();
          for (const t of declaredTools) {
            if (t && t.name) {
              const toolName = t.name;
              const toolDesc = t.description || t.instructions || "";
              const toolParams = t.function?.parameters || t.parameters || { type: "object", properties: {} };
              toolDefs.set(toolName, { name: toolName, description: toolDesc, inputSchema: toolParams });
            }
          }

          if (toolDefs.size > 0) {
            const rawTools = manifest.actions?.agentTools || Array.from(toolDefs.keys());
            hydratedTools = rawTools.map(t => {
              const toolName = typeof t === "string" ? t : t.name;
              const baseName = toolName.replace(/^website_/, "");
              const matched = toolDefs.get(toolName) || toolDefs.get(baseName) || toolDefs.get(`website_${baseName}`);
              return matched || (typeof t === "object" ? t : { name: toolName, description: "", inputSchema: { type: "object", properties: {} } });
            });
          }
        }
      } catch {
        // Fallback to manifest action tools
      }
    }

    // Optional Auto-Wired Action Bridge Client in browser DOM contexts
    let bridgeClient = null;
    if (autoWireBridge && typeof globalThis.window !== "undefined" && typeof globalThis.document !== "undefined") {
      try {
        bridgeClient = createActionBridgeClient({
          bridgeUrl: `${cleanUrl}/bridge/action-bridge.html`,
          brand: manifest.brand || manifest.name || "Peer Bridge"
        });
        const liveCatalog = await bridgeClient.getCatalog().catch(() => null);
        if (Array.isArray(liveCatalog) && liveCatalog.length > 0) {
          hydratedTools = liveCatalog;
        }
      } catch {
        // Fallback to static declarations
      }
    }

    const candidateNode = {
      id: manifest.name || network.name || `node_${Date.now()}`,
      name: manifest.brand || manifest.description || manifest.name || network.name,
      front_man: network.front_man,
      node_url: cleanUrl,
      category: manifest.category || (network.tags && network.tags[0]) || "Specialist",
      description: manifest.description || network.description || "",
      tools: hydratedTools,
      _bridgeClient: bridgeClient
    };

    // User consent check
    if (typeof onConsent === "function") {
      const approved = await onConsent({
        candidate: candidateNode,
        manifest,
        origin: new URL(cleanUrl).origin
      });

      if (!approved) {
        if (bridgeClient && typeof bridgeClient.dispose === "function") {
          bridgeClient.dispose();
        }
        throw new Error(`Mounting of node '${candidateNode.name}' was declined by user consent.`);
      }
    }

    return this.registerNode(candidateNode);
  }

  /**
   * Resolve an exposed tool name back to its owning node and raw tool name.
   */
  resolveTool(toolName) {
    if (this._toolMap.has(toolName)) {
      return this._toolMap.get(toolName);
    }
    if (toolName.includes("__")) {
      const idx = toolName.indexOf("__");
      const nodeId = toolName.slice(0, idx);
      const rawName = toolName.slice(idx + 2);
      const node = this.nodes.get(nodeId);
      return { node, rawName, nodeId, isAmbiguous: false };
    }
    const matchingNodes = [];
    for (const node of this.nodes.values()) {
      const hasTool = (node.tools || []).some(t => (typeof t === "string" ? t : t.name) === toolName);
      if (hasTool) matchingNodes.push(node);
    }
    if (matchingNodes.length === 1) {
      return { node: matchingNodes[0], rawName: toolName, nodeId: matchingNodes[0].id, isAmbiguous: false };
    }
    if (matchingNodes.length > 1) {
      return { node: null, rawName: toolName, nodeId: null, isAmbiguous: true };
    }
    return { node: null, rawName: toolName, nodeId: null, isAmbiguous: false };
  }

  /**
   * Export all registered tools across connected nodes as OpenAI-compatible function calling schemas.
   * Automatically namespaces function names (${nodeId}__${toolName}) when collisions exist across nodes.
   */
  getOpenAITools(toolSubset = null, { namespace = "auto" } = {}) {
    const formatted = [];
    const allowed = toolSubset ? new Set(toolSubset) : null;
    this._toolMap.clear();

    // Count tool names across all nodes to detect cross-peer collisions
    const toolCounts = new Map();
    for (const node of this.nodes.values()) {
      for (const tool of (node.tools || [])) {
        const rawName = typeof tool === "string" ? tool : tool.name;
        if (allowed && !allowed.has(rawName)) continue;
        toolCounts.set(rawName, (toolCounts.get(rawName) || 0) + 1);
      }
    }

    for (const node of this.nodes.values()) {
      for (const tool of (node.tools || [])) {
        const rawName = typeof tool === "string" ? tool : tool.name;
        if (allowed && !allowed.has(rawName)) continue;

        const isCollision = (toolCounts.get(rawName) || 0) > 1;
        const shouldNamespace = namespace === true || (namespace === "auto" && isCollision);
        const safeNodeId = (node.id || "peer").replace(/[^a-zA-Z0-9_]/g, "_");
        const exposedName = shouldNamespace ? `${safeNodeId}__${rawName}` : rawName;

        this._toolMap.set(exposedName, { node, rawName, nodeId: node.id, isAmbiguous: false });
        // CRITICAL BUG FIX: Only register un-namespaced rawName if there is NO collision across peers!
        if (!isCollision) {
          this._toolMap.set(rawName, { node, rawName, nodeId: node.id, isAmbiguous: false });
        }

        const description = typeof tool === "object" && tool.description
          ? tool.description
          : `Action provided by specialist agent '${node.name}' (${node.category})`;

        const parameters = typeof tool === "object" && tool.inputSchema
          ? tool.inputSchema
          : { type: "object", properties: {}, additionalProperties: true };

        formatted.push({
          type: "function",
          function: {
            name: exposedName,
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
   * Compatible with OpenAI, Anthropic, Gemini, Ollama, and custom adapters.
   * Auto-routes to peer action bridges when actionExecutor is omitted, validates tool arguments before execution, and supports SSE token streaming + cancellation via AbortSignal.
   */
  async runTurn({
    prompt,
    messages = null,
    systemInstructions = "You are a helpful autonomous concierge on the Open Agentic Web.",
    model = this.defaultModel,
    routerUrl = this.defaultRouter,
    apiKey = null,
    provider = "openai",
    adapter = null,
    actionExecutor = null,
    maxSteps = 5,
    onStep = null,
    stream = false,
    onToken = null,
    signal = null,
    fetchFn = globalThis.fetch
  }) {
    if (!fetchFn) {
      throw new Error("fetch is required to execute LLM turns.");
    }

    if (signal?.aborted) {
      throw (signal.reason instanceof Error ? signal.reason : new DOMException("The agent turn was aborted.", "AbortError"));
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
      const isStrictTest = prompt?.toLowerCase().includes("strict");
      const mockToolCall = tools.length > 0 && (prompt?.toLowerCase().includes("book") || isStrictTest || prompt?.toLowerCase().includes("action"))
        ? {
            id: "call_mock_1",
            function: {
              name: tools[0].function.name,
              arguments: isStrictTest ? JSON.stringify({ invalid_key: 123 }) : "{}"
            }
          }
        : null;

      if (mockToolCall) {
        let result;
        const { node, rawName } = this.resolveTool(mockToolCall.function.name);
        let args = {};
        try { args = JSON.parse(mockToolCall.function.arguments); } catch {}

        // Pre-validate mock arguments against schema if defined
        const toolDef = (node?.tools || []).find(t => (typeof t === "string" ? t : t.name) === rawName);
        const inputSchema = typeof toolDef === "object" ? toolDef.inputSchema : null;
        if (inputSchema && typeof inputSchema === "object" && Object.keys(inputSchema).length > 0) {
          const validation = validateSchema(inputSchema, args);
          if (!validation.valid) {
            result = {
              ok: false,
              error: `Tool argument validation failed for '${mockToolCall.function.name}': ${validation.errors.join("; ")}`,
              validationErrors: validation.errors
            };
          }
        }

        if (!result) {
          if (typeof actionExecutor === "function") {
            result = await actionExecutor(rawName, args, { nodeId: node?.id, namespacedName: mockToolCall.function.name, node, signal });
          } else if (node && node._bridgeClient && typeof node._bridgeClient.execute === "function") {
            result = await node._bridgeClient.execute(rawName, args, { signal });
          } else {
            result = { ok: true, simulated: true, tool: rawName };
          }
        }

        conversation.push({ role: "assistant", tool_calls: [mockToolCall], content: null });
        conversation.push({ role: "tool", tool_call_id: mockToolCall.id, name: mockToolCall.function.name, content: JSON.stringify(result) });
        const finalContent = result.ok === false
          ? `Tool argument validation failed: ${result.error}`
          : `Mock synthesis completed for ${rawName}.`;
        conversation.push({ role: "assistant", content: finalContent });
        return { ok: true, text: finalContent, messages: conversation, stepsCount: 2, toolCallsCount: 1 };
      }

      const reply = `Mock offline response for: ${prompt}`;
      conversation.push({ role: "assistant", content: reply });
      return { ok: true, text: reply, messages: conversation, stepsCount: 1, toolCallsCount: 0 };
    }

    while (step < maxSteps) {
      if (signal?.aborted) {
        throw new DOMException("The agent turn was aborted.", "AbortError");
      }
      step++;

      let message;

      if (typeof adapter === "function") {
        const adapterRes = await adapter({
          prompt,
          messages: conversation,
          tools,
          model,
          routerUrl,
          apiKey,
          signal,
          stream,
          onToken,
          fetchFn
        });
        message = adapterRes?.message || adapterRes;
      } else if (provider === "anthropic") {
        const endpoint = routerUrl && !routerUrl.includes("otari.ai")
          ? routerUrl
          : "https://api.anthropic.com/v1/messages";

        const anthropicMessages = [];
        for (const msg of conversation) {
          if (msg.role === "system") continue;
          if (msg.role === "assistant" && msg.tool_calls) {
            anthropicMessages.push({
              role: "assistant",
              content: msg.tool_calls.map(tc => ({
                type: "tool_use",
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments || "{}")
              }))
            });
          } else if (msg.role === "tool") {
            anthropicMessages.push({
              role: "user",
              content: [{
                type: "tool_result",
                tool_use_id: msg.tool_call_id,
                content: msg.content
              }]
            });
          } else {
            anthropicMessages.push({ role: msg.role, content: msg.content });
          }
        }

        const anthropicTools = tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }));

        const res = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey || "",
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model,
            system: systemInstructions,
            messages: anthropicMessages,
            tools: anthropicTools.length > 0 ? anthropicTools : undefined,
            max_tokens: 1024
          }),
          signal
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Anthropic inference failed at '${endpoint}' (HTTP ${res.status}): ${errText}`);
        }

        const data = await res.json();
        const textBlock = (data.content || []).find(b => b.type === "text");
        const toolBlocks = (data.content || []).filter(b => b.type === "tool_use");

        message = {
          role: "assistant",
          content: textBlock?.text || null,
          tool_calls: toolBlocks.length > 0
            ? toolBlocks.map(tb => ({
                id: tb.id,
                function: { name: tb.name, arguments: JSON.stringify(tb.input || {}) }
              }))
            : undefined
        };
      } else {
        // OpenAI / Otari / OpenRouter / Ollama default
        const endpoint = routerUrl.endsWith("/chat/completions")
          ? routerUrl
          : `${routerUrl.replace(/\/$/, "")}/chat/completions`;

        const payload = {
          model,
          messages: conversation,
          tools: tools.length > 0 ? tools : undefined,
          stream: Boolean(stream && typeof onToken === "function")
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
          body: JSON.stringify(payload),
          signal
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`LLM inference failed at '${endpoint}' (HTTP ${res.status}): ${errText}`);
        }

        if (payload.stream && res.body && typeof res.body.getReader === "function") {
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let fullContent = "";
          const toolCallsMap = new Map();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") continue;
              if (trimmed.startsWith("data: ")) {
                try {
                  const chunk = JSON.parse(trimmed.slice(6));
                  const delta = chunk.choices?.[0]?.delta;
                  if (delta?.content) {
                    fullContent += delta.content;
                    onToken(delta.content);
                  }
                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolCallsMap.has(idx)) {
                        toolCallsMap.set(idx, { id: tc.id || `call_${idx}`, function: { name: tc.function?.name || "", arguments: "" } });
                      }
                      const existing = toolCallsMap.get(idx);
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.function.name += tc.function.name;
                      if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                    }
                  }
                } catch {}
              }
            }
          }

          const tool_calls = Array.from(toolCallsMap.values()).filter(t => t.function.name);
          message = {
            role: "assistant",
            content: fullContent || null,
            tool_calls: tool_calls.length > 0 ? tool_calls : undefined
          };
        } else {
          const data = await res.json();
          message = data.choices?.[0]?.message;
        }
      }

      if (!message) {
        throw new Error("Invalid response format from LLM router: missing message in choices");
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
          const { node, rawName, isAmbiguous } = this.resolveTool(toolName);

          if (isAmbiguous) {
            result = {
              ok: false,
              error: `Tool '${toolName}' is ambiguous across multiple peers. Call with namespaced name '${node?.id || "peer"}__${rawName}'.`
            };
          } else {
            // Validate LLM tool arguments against schema before sending to bridge or executor
            const toolDef = (node?.tools || []).find(t => (typeof t === "string" ? t : t.name) === rawName);
            const inputSchema = typeof toolDef === "object" ? toolDef.inputSchema : null;

            if (inputSchema && typeof inputSchema === "object" && Object.keys(inputSchema).length > 0) {
              const validation = validateSchema(inputSchema, args);
              if (!validation.valid) {
                result = {
                  ok: false,
                  error: `Argument validation failed for tool '${toolName}': ${validation.errors.join("; ")}`,
                  validationErrors: validation.errors
                };
              }
            }

            if (!result) {
              if (typeof actionExecutor === "function") {
                try {
                  result = await actionExecutor(rawName, args, {
                    nodeId: node?.id,
                    namespacedName: toolName,
                    node,
                    signal
                  });
                } catch (err) {
                  result = { ok: false, error: err.message };
                }
              } else if (node && node._bridgeClient && typeof node._bridgeClient.execute === "function") {
                try {
                  const isIrreversible = (toolDef && typeof toolDef === "object" && toolDef.effect === "irreversible") ||
                                         (toolDef && typeof toolDef === "object" && toolDef.category === "booking");
                  const execOpts = { signal };
                  if (isIrreversible) {
                    execOpts.requirePopup = true;
                  }
                  result = await node._bridgeClient.execute(rawName, args, execOpts);
                } catch (err) {
                  result = { ok: false, error: err.message };
                }
              } else {
                result = { ok: true, message: `Tool '${rawName}' executed in swarm context.` };
              }
            }
          }

          if (typeof onStep === "function") {
            try {
              onStep({ step, tool: rawName, namespacedTool: toolName, arguments: args, result });
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
   * Dispose all active bridge client iframes associated with mounted nodes.
   */
  dispose() {
    for (const node of this.nodes.values()) {
      if (node._bridgeClient && typeof node._bridgeClient.dispose === "function") {
        try { node._bridgeClient.dispose(); } catch {}
        node._bridgeClient = null;
      }
    }
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
