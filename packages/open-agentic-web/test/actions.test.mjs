import assert from "node:assert";
import { describe, it } from "node:test";
import { ActionSecurityError, ActionValidationError, createActionRegistry, defineAction, validateSchema } from "../src/actions.js";
import { setupActionBridge } from "../src/bridge.js";

describe("Open Agentic Web - Site Actions & Validation", () => {
  it("validates data correctly with validateSchema", () => {
    const schema = {
      type: "object",
      properties: {
        destination: { type: "string", minLength: 3 },
        party_size: { type: "integer", minimum: 1 },
        tier: { type: "string", enum: ["standard", "vip"] }
      },
      required: ["destination", "party_size"],
      additionalProperties: false
    };

    // Valid data
    const valid = validateSchema(schema, { destination: "San Francisco", party_size: 2, tier: "vip" });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.errors.length, 0);

    // Missing required
    const missing = validateSchema(schema, { party_size: 2 });
    assert.strictEqual(missing.valid, false);
    assert.ok(missing.errors.some(e => e.includes("Missing required property 'destination'")));

    // Invalid enum
    const badEnum = validateSchema(schema, { destination: "SF", party_size: 2, tier: "gold" });
    assert.strictEqual(badEnum.valid, false);
    assert.ok(badEnum.errors.some(e => e.includes("is not one of: \"standard\", \"vip\"")));

    // Additional property
    const extra = validateSchema(schema, { destination: "SF", party_size: 2, unknown: 123 });
    assert.strictEqual(extra.valid, false);
    assert.ok(extra.errors.some(e => e.includes("Unexpected property 'unknown'")));
  });

  it("defines and executes an action with automatic validation", async () => {
    const action = defineAction({
      name: "website_search_rooms",
      description: "Search available rooms",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {
          nights: { type: "integer", minimum: 1 }
        },
        required: ["nights"]
      },
      execute: async (args) => {
        return { ok: true, rooms: [`Room for ${args.nights} nights`] };
      }
    });

    assert.strictEqual(action.name, "website_search_rooms");
    assert.strictEqual(action.effect, "read");
    assert.strictEqual(action.availability, "bridge");

    // Success call
    const res = await action.execute({ nights: 3 });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.rooms[0], "Room for 3 nights");

    // Invalid call (throws ActionValidationError)
    await assert.rejects(
      async () => action.execute({ nights: -1 }),
      ActionValidationError
    );
  });

  it("manages actions via createActionRegistry", async () => {
    const registry = createActionRegistry();
    registry.register({
      name: "website_book_ticket",
      description: "Book event pass",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        properties: { count: { type: "integer" } },
        required: ["count"]
      },
      execute: async (args) => ({ booked: args.count })
    });

    assert.strictEqual(registry.has("website_book_ticket"), true);
    assert.strictEqual(registry.has("unknown_tool"), false);

    const catalog = registry.catalog();
    assert.strictEqual(catalog.length, 1);
    assert.strictEqual(catalog[0].name, "website_book_ticket");
    assert.strictEqual(catalog[0].availability, "bridge");

    const execResult = await registry.execute("website_book_ticket", { count: 4 });
    assert.strictEqual(execResult.booked, 4);
  });

  it("enforces human confirmation on irreversible actions", async () => {
    let confirmCalled = false;
    const action = defineAction({
      name: "website_irreversible_transfer",
      description: "Transfer money or commit booking",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        properties: { amount: { type: "number" } },
        required: ["amount"]
      },
      execute: async (args) => ({ transferred: args.amount })
    });

    // 1. Rejected if requireConfirmation is set and not confirmed
    await assert.rejects(
      async () => action.execute({ amount: 100 }, { requireConfirmation: true, confirmed: false }),
      ActionSecurityError
    );

    // 2. onConfirm callback approves
    const approvedResult = await action.execute(
      { amount: 100 },
      {
        onConfirm: async ({ name, arguments: args }) => {
          confirmCalled = true;
          assert.strictEqual(name, "website_irreversible_transfer");
          assert.strictEqual(args.amount, 100);
          return true; // user confirms
        }
      }
    );
    assert.strictEqual(confirmCalled, true);
    assert.strictEqual(approvedResult.transferred, 100);

    // 3. onConfirm callback rejects
    await assert.rejects(
      async () => action.execute(
        { amount: 100 },
        { onConfirm: async () => false } // user declines
      ),
      ActionSecurityError
    );
  });

  it("exports actions to OpenAI tools, MCP tools, and WebMCP adapter format", async () => {
    const registry = createActionRegistry();
    registry.register(
      defineAction({
        name: "website_check_rates",
        description: "Check live daily room rates",
        effect: "read",
        inputSchema: {
          type: "object",
          properties: { room_type: { type: "string" } },
          required: ["room_type"]
        },
        execute: async (args) => ({ rate: 199 })
      })
    );

    // OpenAI format
    const openaiTools = registry.toOpenAITools();
    assert.strictEqual(openaiTools.length, 1);
    assert.strictEqual(openaiTools[0].type, "function");
    assert.strictEqual(openaiTools[0].function.name, "website_check_rates");
    assert.deepStrictEqual(openaiTools[0].function.parameters.required, ["room_type"]);

    // MCP format
    const mcpTools = registry.toMCPTools();
    assert.strictEqual(mcpTools.length, 1);
    assert.strictEqual(mcpTools[0].name, "website_check_rates");
    assert.strictEqual(mcpTools[0].description, "Check live daily room rates");
    assert.deepStrictEqual(mcpTools[0].inputSchema.required, ["room_type"]);

    // WebMCP gracefully returns false if navigator.modelContext is not present in Node
    const webMcpRegistered = await registry.registerWebMCP();
    assert.strictEqual(webMcpRegistered, false);
  });

  it("validates pattern, format, defaults, oneOf, and anyOf in validateSchema", () => {
    const schema = {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        website: { type: "string", format: "uri" },
        code: { type: "string", pattern: "^[A-Z]{3}-\\d{3}$" },
        role: { type: "string", default: "guest" },
        choice: {
          oneOf: [
            { type: "string", enum: ["standard", "deluxe"] },
            { type: "integer", minimum: 1, maximum: 5 }
          ]
        }
      },
      required: ["email", "code"]
    };

    // Valid data with default injection
    const target = { email: "user@example.com", code: "SFO-101", choice: "deluxe" };
    const res = validateSchema(schema, target);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(target.role, "guest", "default value should be injected");

    // Invalid format & pattern
    const invalidRes = validateSchema(schema, {
      email: "not-an-email",
      code: "invalid-code",
      website: "ftp://wrong",
      choice: true
    });
    assert.strictEqual(invalidRes.valid, false);
    assert.ok(invalidRes.errors.some(e => e.includes("does not match format 'email'")));
    assert.ok(invalidRes.errors.some(e => e.includes("does not match pattern")));
    assert.ok(invalidRes.errors.some(e => e.includes("does not match any allowed oneOf schema")));
  });

  it("supports undoable actions and maintains audit logs in createActionRegistry", async () => {
    let unDoneCount = 0;
    const executedLogs = [];

    const registry = createActionRegistry({
      onActionExecuted: (record) => executedLogs.push(record)
    });

    registry.register(
      defineAction({
        name: "website_hold_reservation",
        description: "Hold hotel room reservation",
        effect: "undoable",
        inputSchema: {
          type: "object",
          properties: { reservationId: { type: "string" } },
          required: ["reservationId"]
        },
        execute: async (args) => ({ status: "HELD", id: args.reservationId }),
        undo: async (args, execResult) => {
          unDoneCount++;
          return { status: "RELEASED", id: args.reservationId };
        }
      })
    );

    const execResult = await registry.execute("website_hold_reservation", { reservationId: "RES-999" });
    assert.strictEqual(execResult.status, "HELD");

    // Check audit log
    const audit = registry.getAuditLog();
    assert.strictEqual(audit.length, 1);
    assert.strictEqual(audit[0].actionName, "website_hold_reservation");
    assert.strictEqual(audit[0].effect, "undoable");
    assert.strictEqual(executedLogs.length, 1);

    // Perform undo
    const undoRes = await registry.undo("website_hold_reservation", { reservationId: "RES-999" }, execResult);
    assert.strictEqual(unDoneCount, 1);
    assert.strictEqual(undoRes.status, "RELEASED");
  });

  it("converts manifest and actions to A2A Agent Card using toA2AAgentCard", () => {
    const registry = createActionRegistry();
    registry.register(
      defineAction({
        name: "website_search_rooms",
        description: "Search hotel rooms",
        effect: "read",
        inputSchema: { type: "object", properties: { city: { type: "string" } } },
        execute: async () => ({})
      })
    );

    const manifest = {
      name: "tripsteward_hub",
      description: "Autonomous Travel Concierge",
      category: "Hospitality",
      version: "1.0.0",
      actions: {
        agentTools: ["website_search_rooms"]
      }
    };

    const card = registry.toA2AAgentCard(manifest, {
      url: "https://tripsteward.example.com",
      provider: "TripSteward Corp"
    });

    assert.strictEqual(card.name, "tripsteward_hub");
    assert.strictEqual(card.url, "https://tripsteward.example.com");
    assert.strictEqual(card.provider.name, "TripSteward Corp");
    assert.ok(card.skills.length >= 1);
    assert.strictEqual(card.skills[0].id, "website_search_rooms");
    assert.strictEqual(card.capabilities.actions, true);
    assert.strictEqual(card.capabilities.pushNotifications, false);
  });

  it("cleans and extracts version correctly in toA2AAgentCard from specification URL", () => {
    const registry = createActionRegistry();
    const manifest = {
      name: "tablebespoke_concierge",
      specification: "https://cognizant-ai-labs.github.io/agentic-web/specs/mvp-v0.3.json"
    };
    const card = registry.toA2AAgentCard(manifest, { url: "https://pnrs.is-a.dev/dining" });
    assert.strictEqual(card.version, "0.3.0");
    assert.ok(!card.version.includes("json"));
  });

  it("announces readiness to windowObj.opener in setupActionBridge", async () => {
    const registry = createActionRegistry();
    registry.register(
      defineAction({
        name: "website_reserve_dining_table",
        description: "Reserve dining table",
        effect: "irreversible",
        execute: async () => ({ reserved: true })
      })
    );

    const posted = [];
    const mockOpener = {
      postMessage: (msg, targetOrigin) => {
        posted.push({ msg, targetOrigin });
      }
    };

    const mockWindow = {
      opener: mockOpener,
      parent: null,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const bridge = setupActionBridge({
      registry,
      allowedOrigins: ["*"],
      windowObj: mockWindow
    });

    assert.ok(posted.length >= 1);
    assert.strictEqual(posted[0].msg.type, "ready");
    assert.strictEqual(posted[0].msg.protocol, "nsdeploy-actions-v1");

    bridge.dispose();
  });
});
