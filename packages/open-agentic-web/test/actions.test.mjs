import assert from "node:assert";
import { describe, it } from "node:test";
import { ActionValidationError, createActionRegistry, defineAction, validateSchema } from "../src/actions.js";

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

    const execResult = await registry.execute("website_book_ticket", { count: 4 });
    assert.strictEqual(execResult.booked, 4);
  });
});
