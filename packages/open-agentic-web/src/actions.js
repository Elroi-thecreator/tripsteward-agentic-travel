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
 * Supports: type, properties, required, additionalProperties, enum, items, min/max, minLength/maxLength.
 */
export function validateSchema(schema, data, path = "") {
  const errors = [];
  if (!schema || typeof schema !== "object") return { valid: true, errors: [] };

  const fieldDesc = path ? `at '${path}'` : "input";

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

  // Object checks
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
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

  // String bounds
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`String ${fieldDesc} length (${data.length}) is less than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`String ${fieldDesc} length (${data.length}) exceeds maxLength ${schema.maxLength}`);
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

  const { name, description, effect = "read", inputSchema = {}, execute, confirmsInWindow = false } = definition;

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Action must declare a non-empty string 'name'.");
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new Error(`Action '${name}' must declare a descriptive 'description'.`);
  }

  const validEffects = ["read", "irreversible", "undoable"];
  if (!validEffects.includes(effect)) {
    throw new Error(`Action '${name}' declares invalid effect '${effect}'. Must be one of: ${validEffects.join(", ")}.`);
  }

  if (typeof execute !== "function") {
    throw new Error(`Action '${name}' must provide an executable async function 'execute(args, context)'.`);
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
    inputSchema: normalizedInputSchema,
    confirmsInWindow,
    rawExecute: execute,
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
 * Create a registry of site actions.
 */
export function createActionRegistry() {
  const actionsMap = new Map();

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
     * Execute an action by name with input arguments
     */
    async execute(name, args = {}, context = {}) {
      const action = actionsMap.get(name);
      if (!action) {
        throw new Error(`Action '${name}' is not registered in this action registry.`);
      }
      return action.execute(args, context);
    }
  };
}
