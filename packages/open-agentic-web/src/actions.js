/**
 * Open Agentic Web — Site Actions & Runtime Framework
 * Implements type-safe action definitions, JSON schema validation,
 * effect categories ('read', 'irreversible', 'undoable'), and action registry.
 */

export class ActionValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = "ActionValidationError";
    this.errors = errors;
  }
}

export class ActionSecurityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ActionSecurityError";
    this.details = details;
  }
}

/**
 * Validates a JavaScript value against a JSON Schema subset.
 * Supports: type, properties, required, default, additionalProperties, enum, pattern, format, items, min/max, minLength/maxLength, oneOf, anyOf.
 */
export function validateSchema(schema, data, path = "") {
  const errors = [];
  if (!schema || typeof schema !== "object") return { valid: true, errors: [] };

  const fieldDesc = path ? `at '${path}'` : "input";

  // oneOf / anyOf composition checks
  if (Array.isArray(schema.anyOf)) {
    const passed = schema.anyOf.some(sub => validateSchema(sub, data, path).valid);
    if (!passed) {
      errors.push(`Value ${fieldDesc} does not match any of the allowed schemas in anyOf`);
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const passCount = schema.oneOf.filter(sub => validateSchema(sub, data, path).valid).length;
    if (passCount !== 1) {
      errors.push(`Value ${fieldDesc} does not match any allowed oneOf schema (matched ${passCount}, exactly 1 required)`);
    }
  }

  // Type check
  if (schema.type) {
    const expectedType = schema.type;
    const actualType = Array.isArray(data)
      ? "array"
      : data === null
      ? "null"
      : typeof data;

    if (expectedType === "integer") {
      if (typeof data !== "number" || !Number.isInteger(data)) {
        errors.push(`Expected integer ${fieldDesc}, got ${actualType}`);
      }
    } else if (expectedType === "number") {
      if (typeof data !== "number" || Number.isNaN(data)) {
        errors.push(`Expected number ${fieldDesc}, got ${actualType}`);
      }
    } else if (actualType !== expectedType) {
      errors.push(`Expected ${expectedType} ${fieldDesc}, got ${actualType}`);
    }
  }

  // Enum check
  if (Array.isArray(schema.enum) && data !== undefined) {
    if (!schema.enum.includes(data)) {
      errors.push(`Value ${JSON.stringify(data)} ${fieldDesc} is not one of: ${schema.enum.map(v => JSON.stringify(v)).join(", ")}`);
    }
  }

  // Object checks & default value injection
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    // Default value injection for missing properties
    if (schema.properties && typeof schema.properties === "object") {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (data[propKey] === undefined && propSchema.default !== undefined) {
          data[propKey] = typeof propSchema.default === "object"
            ? JSON.parse(JSON.stringify(propSchema.default))
            : propSchema.default;
        }
      }
    }

    // Required properties
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (data[reqKey] === undefined) {
          errors.push(`Missing required property '${reqKey}' ${fieldDesc}`);
        }
      }
    }

    // Property-level validation
    if (schema.properties && typeof schema.properties === "object") {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (data[propKey] !== undefined) {
          const subPath = path ? `${path}.${propKey}` : propKey;
          const subResult = validateSchema(propSchema, data[propKey], subPath);
          errors.push(...subResult.errors);
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data)) {
        if (!allowedKeys.has(key)) {
          errors.push(`Unexpected property '${key}' ${fieldDesc} (additionalProperties: false)`);
        }
      }
    }
  }

  // Array items check
  if (Array.isArray(data) && schema.items) {
    data.forEach((item, index) => {
      const subPath = `${path}[${index}]`;
      const itemResult = validateSchema(schema.items, item, subPath);
      errors.push(...itemResult.errors);
    });
  }

  // String bounds, pattern, and format
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`String ${fieldDesc} length (${data.length}) is less than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`String ${fieldDesc} length (${data.length}) exceeds maxLength ${schema.maxLength}`);
    }
    if (schema.pattern) {
      try {
        if (schema.pattern.length > 250) {
          errors.push(`Pattern ${fieldDesc} exceeds maximum length limit of 250 characters.`);
        } else {
          const regex = new RegExp(schema.pattern);
          if (!regex.test(data)) {
            errors.push(`String ${fieldDesc} does not match pattern '${schema.pattern}'`);
          }
        }
      } catch (err) {
        errors.push(`Invalid regular expression pattern on ${fieldDesc}: ${err.message}`);
      }
    }
    if (schema.format) {
      const format = schema.format.toLowerCase();
      if (format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
        errors.push(`String ${fieldDesc} does not match format 'email' (invalid email address)`);
      } else if ((format === "uri" || format === "url") && !/^https?:\/\/[^\s]+$/.test(data)) {
        errors.push(`String ${fieldDesc} does not match format 'uri' (invalid URI/URL)`);
      } else if (format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        errors.push(`String ${fieldDesc} does not match format 'date' (must be YYYY-MM-DD)`);
      } else if (format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
        errors.push(`String ${fieldDesc} does not match format 'uuid' (invalid UUID)`);
      }
    }
  }

  // Numeric bounds
  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`Number ${fieldDesc} (${data}) is less than minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`Number ${fieldDesc} (${data}) exceeds maximum ${schema.maximum}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Define a conforming Open Agentic Web site action with runtime schema validation.
 */
export function defineAction(definition) {
  if (!definition || typeof definition !== "object") {
    throw new Error("Action definition must be a valid configuration object.");
  }

  const { name, description, effect = "read", availability = "bridge", inputSchema = {}, execute, undo = null, confirmsInWindow = false } = definition;

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Action must declare a non-empty string 'name'.");
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new Error(`Action '${name}' must declare a descriptive 'description'.`);
  }

  const validEffects = ["read", "write", "irreversible", "undoable"];
  if (!validEffects.includes(effect)) {
    throw new Error(`Action '${name}' declares invalid effect '${effect}'. Must be one of: ${validEffects.join(", ")}.`);
  }

  if (typeof execute !== "function") {
    throw new Error(`Action '${name}' must provide an executable async function 'execute(args, context)'.`);
  }

  if (effect === "undoable" && undo && typeof undo !== "function") {
    throw new Error(`Action '${name}' declared an invalid 'undo' handler. Must be an async function.`);
  }

  const normalizedInputSchema = {
    type: "object",
    properties: inputSchema.properties || {},
    required: inputSchema.required || [],
    additionalProperties: inputSchema.additionalProperties ?? false,
    ...inputSchema
  };

  return {
    name,
    description,
    effect,
    availability: definition.availability || availability || "bridge",
    inputSchema: normalizedInputSchema,
    confirmsInWindow,
    rawExecute: execute,
    undo: undo || null,
    execute: async (args = {}, context = {}) => {
      const validation = validateSchema(normalizedInputSchema, args);
      if (!validation.valid) {
        throw new ActionValidationError(
          `Validation failed for action '${name}':\n- ${validation.errors.join("\n- ")}`,
          validation.errors
        );
      }

      // Human confirmation security gate for irreversible actions
      if (effect === "irreversible") {
        const confirmHook = context.onConfirm || definition.onConfirm;
        if (typeof confirmHook === "function") {
          const approved = await confirmHook({
            name,
            action: name,
            arguments: args,
            effect,
            context
          });
          if (!approved) {
            throw new ActionSecurityError(
              `Action '${name}' was rejected by user confirmation policy.`,
              { action: name, effect, arguments: args }
            );
          }
        } else if (context.requireConfirmation && !context.confirmed) {
          throw new ActionSecurityError(
            `Action '${name}' is irreversible and requires explicit confirmation.`,
            { action: name, effect, arguments: args }
          );
        }
      }

      return execute(args, context);
    }
  };
}

/**
 * Create a registry of site actions with audit logging and undo support.
 */
export function createActionRegistry({ onActionExecuted = null, onActionError = null } = {}) {
  const actionsMap = new Map();
  const auditLog = [];

  return {
    /**
     * Register one or multiple actions.
     */
    register(actionDef) {
      if (Array.isArray(actionDef)) {
        actionDef.forEach(act => this.register(act));
        return this;
      }
      const action = actionDef.rawExecute ? actionDef : defineAction(actionDef);
      actionsMap.set(action.name, action);
      return this;
    },

    get(name) {
      return actionsMap.get(name);
    },

    has(name) {
      return actionsMap.has(name);
    },

    list() {
      return Array.from(actionsMap.values());
    },

    names() {
      return Array.from(actionsMap.keys());
    },

    /**
     * Output catalog of registered tools suitable for agent-manifest.json or discovery
     */
    catalog() {
      return this.list().map(a => ({
        name: a.name,
        description: a.description,
        effect: a.effect,
        availability: a.availability || "bridge",
        inputSchema: a.inputSchema,
        confirmsInWindow: a.confirmsInWindow
      }));
    },

    /**
     * Export tools in OpenAI / Vercel AI SDK function calling format
     */
    toOpenAITools() {
      return this.list().map(a => ({
        type: "function",
        function: {
          name: a.name,
          description: a.description,
          parameters: a.inputSchema
        }
      }));
    },

    /**
     * Export tools in Model Context Protocol (MCP) format
     */
    toMCPTools() {
      return this.list().map(a => ({
        name: a.name,
        description: a.description,
        inputSchema: a.inputSchema
      }));
    },

    /**
     * Register tools into browser native WebMCP (navigator.modelContext) if available
     */
    async registerWebMCP() {
      if (typeof navigator !== "undefined" && navigator.modelContext && typeof navigator.modelContext.registerTool === "function") {
        for (const act of this.list()) {
          await navigator.modelContext.registerTool({
            name: act.name,
            description: act.description,
            parameters: act.inputSchema,
            execute: async (args) => this.execute(act.name, args)
          });
        }
        return true;
      }
      return false;
    },

    /**
     * Retrieve chronological audit log of all executed actions
     */
    getAuditLog() {
      return [...auditLog];
    },

    /**
     * Execute an action by name with input arguments and records audit trail
     */
    async execute(name, args = {}, context = {}) {
      const action = actionsMap.get(name);
      if (!action) {
        throw new Error(`Action '${name}' is not registered in this action registry.`);
      }

      const timestamp = new Date().toISOString();
      try {
        const result = await action.execute(args, context);
        const record = { timestamp, action: name, actionName: name, effect: action.effect, arguments: args, result, ok: true };
        auditLog.push(record);
        if (typeof onActionExecuted === "function") {
          try { onActionExecuted(record); } catch {}
        }
        return result;
      } catch (err) {
        const record = { timestamp, action: name, actionName: name, effect: action.effect, arguments: args, error: err.message, ok: false };
        auditLog.push(record);
        if (typeof onActionError === "function") {
          try { onActionError(record, err); } catch {}
        }
        throw err;
      }
    },

    /**
     * Undo a previously executed action (for actions with effect: 'undoable')
     */
    async undo(name, args = {}, context = {}) {
      const action = actionsMap.get(name);
      if (!action) {
        throw new Error(`Action '${name}' is not registered in this action registry.`);
      }
      if (action.effect !== "undoable" || typeof action.undo !== "function") {
        throw new Error(`Action '${name}' does not implement an undo handler.`);
      }

      const timestamp = new Date().toISOString();
      const undoResult = await action.undo(args, context);
      auditLog.push({ timestamp, action: name, actionName: name, effect: "undo", arguments: args, result: undoResult, ok: true });
      return undoResult;
    },

    /**
     * Converts manifest and registered actions into an A2A Agent Card
     */
    toA2AAgentCard(manifest, options = {}) {
      return toA2AAgentCard(manifest, { ...options, registry: this, baseUrl: options.baseUrl || options.url });
    }
  };
}

/**
 * Converts a conforming agent-manifest.json into a standard Linux Foundation / Google
 * Agent-to-Agent (A2A) Agent Card (/.well-known/agent.json).
 */
export function toA2AAgentCard(manifest, { baseUrl = "http://localhost", url = null, provider = null, registry = null } = {}) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Invalid manifest object provided to toA2AAgentCard.");
  }

  const effectiveUrl = url || baseUrl || "http://localhost";
  const cleanBaseUrl = String(effectiveUrl).replace(/\/$/, "");
  const primaryNetwork = manifest.networks?.[0];

  const providerObj = typeof provider === "string"
    ? { name: provider, url: cleanBaseUrl }
    : (provider && typeof provider === "object")
      ? provider
      : { name: manifest.brand || manifest.name || "Open Agentic Web", url: cleanBaseUrl };

  // Resolve skills from registry catalog if available, or manifest action tools
  const catalogTools = registry && typeof registry.catalog === "function" ? registry.catalog() : null;
  const toolNames = manifest.actions?.agentTools || (catalogTools ? catalogTools.map(t => t.name) : []);

  const skills = toolNames.map(toolName => {
    const catalogItem = catalogTools ? catalogTools.find(c => c.name === toolName) : null;
    return {
      id: toolName,
      name: toolName,
      description: catalogItem?.description || `Execute ${toolName} on ${manifest.brand || manifest.name}`,
      inputSchema: catalogItem?.inputSchema || { type: "object", properties: {} },
      effect: catalogItem?.effect || "read"
    };
  });

  return {
    $schema: "https://schemas.agent2agent.org/v1/agent-card.json",
    name: manifest.brand || manifest.name || "Agentic Web Node",
    description: manifest.description || "",
    url: cleanBaseUrl,
    version: (() => {
      if (manifest.version) return String(manifest.version);
      if (manifest.specification) {
        const match = String(manifest.specification).match(/v?(\d+\.\d+(?:\.\d+)?)/i);
        if (match) return match[1].split('.').length === 2 ? `${match[1]}.0` : match[1];
      }
      return "0.3.0";
    })(),
    provider: providerObj,
    identity: {
      brand: manifest.brand || manifest.name,
      frontMan: primaryNetwork?.front_man || "agent",
      category: manifest.category || (primaryNetwork?.tags && primaryNetwork.tags[0]) || "Concierge"
    },
    skills,
    capabilities: {
      actions: true,
      pushNotifications: false,
      tools: toolNames,
      networks: (manifest.networks || []).map(n => n.name),
      actionBridgeUrl: `${cleanBaseUrl}/bridge/action-bridge.html`
    },
    protocols: [
      {
        name: "nsdeploy-actions-v1",
        version: "1.0.0",
        endpoint: `${cleanBaseUrl}/bridge/action-bridge.html`
      }
    ],
    authentication: {
      type: "byok",
      description: "Bring Your Own Key client-side inference"
    }
  };
}

/**
 * Drop-in accessible HTML consent and confirmation modal for browser environments.
 * Replaces window.confirm() with a clean modal dialog.
 */
export function createConsentDialog({
  title = "Authorize Action",
  message = "An autonomous agent is requesting permission to execute an action.",
  details = null,
  confirmText = "Authorize",
  cancelText = "Decline",
  documentObj = globalThis.document
} = {}) {
  if (!documentObj) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const dialog = documentObj.createElement("dialog");
    dialog.style.cssText = `
      border: 1px solid rgba(0,0,0,0.15);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      max-width: 480px;
      width: 90%;
      font-family: system-ui, -apple-system, sans-serif;
      color: #1e293b;
    `;

    const titleEl = documentObj.createElement("h3");
    titleEl.textContent = title;
    titleEl.style.margin = "0 0 12px 0";

    const msgEl = documentObj.createElement("p");
    msgEl.textContent = message;
    msgEl.style.margin = "0 0 16px 0";
    msgEl.style.fontSize = "14px";
    msgEl.style.color = "#475569";

    dialog.appendChild(titleEl);
    dialog.appendChild(msgEl);

    if (details) {
      const preEl = documentObj.createElement("pre");
      preEl.textContent = typeof details === "string" ? details : JSON.stringify(details, null, 2);
      preEl.style.cssText = "background: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 12px; max-height: 140px; overflow: auto; margin-bottom: 16px;";
      dialog.appendChild(preEl);
    }

    const btnContainer = documentObj.createElement("div");
    btnContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px;";

    const cancelBtn = documentObj.createElement("button");
    cancelBtn.textContent = cancelText;
    cancelBtn.style.cssText = "padding: 8px 16px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; cursor: pointer;";

    const confirmBtn = documentObj.createElement("button");
    confirmBtn.textContent = confirmText;
    confirmBtn.style.cssText = "padding: 8px 16px; border-radius: 6px; border: none; background: #0284c7; color: white; font-weight: 500; cursor: pointer;";

    const cleanup = (result) => {
      try { dialog.close(); } catch {}
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
      resolve(result);
    };

    cancelBtn.addEventListener("click", () => cleanup(false));
    confirmBtn.addEventListener("click", () => cleanup(true));

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    dialog.appendChild(btnContainer);

    documentObj.body.appendChild(dialog);
    try {
      dialog.showModal();
    } catch {
      cleanup(false);
    }
  });
}
