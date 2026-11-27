import assert from "node:assert";
import { resolve } from "node:path";
import test, { describe } from "node:test";
import { createActionRegistry, defineAction } from "../src/actions.js";
import { createMCPServer } from "../src/mcp.js";

describe("Open Agentic Web - Model Context Protocol (MCP) Server", () => {
  test("initializes correctly with JSON-RPC 2.0 handshake", async () => {
    const server = createMCPServer();
    const initResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    });

    assert.strictEqual(initResponse.jsonrpc, "2.0");
    assert.strictEqual(initResponse.id, 1);
    assert.strictEqual(initResponse.result.protocolVersion, "2024-11-05");
    assert.strictEqual(initResponse.result.serverInfo.name, "open-agentic-web-mcp");
    assert.ok(initResponse.result.capabilities.tools);
    assert.ok(initResponse.result.capabilities.resources);

    // Initialized notification returns null
    const notifResponse = await server.handleMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
    assert.strictEqual(notifResponse, null);

    // Ping
    const pingResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "ping"
    });
    assert.deepStrictEqual(pingResponse.result, {});
  });

  test("lists built-in OAW tools and registered site actions", async () => {
    const registry = createActionRegistry();
    registry.register(defineAction({
      name: "custom_mcp_tool",
      description: "A custom test tool",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } }
      },
      execute: async ({ query }) => ({ echo: query })
    }));

    const server = createMCPServer({ registry });
    const listResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/list"
    });

    const tools = listResponse.result.tools;
    assert.ok(Array.isArray(tools));
    const toolNames = tools.map(t => t.name);

    // Built-in tools
    assert.ok(toolNames.includes("oaw_validate_node"));
    assert.ok(toolNames.includes("oaw_audit_federation"));
    assert.ok(toolNames.includes("oaw_list_actions"));
    assert.ok(toolNames.includes("oaw_generate_a2a"));
    assert.ok(toolNames.includes("oaw_inspect_node"));

    // Custom tool
    assert.ok(toolNames.includes("custom_mcp_tool"));
  });

  test("executes built-in and custom tools via tools/call", async () => {
    const registry = createActionRegistry();
    registry.register(defineAction({
      name: "calculate_fare",
      description: "Calculates mock fare",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: { distanceKm: { type: "number" } },
        required: ["distanceKm"]
      },
      execute: async ({ distanceKm }) => ({ fare: distanceKm * 3.5 })
    }));

    const server = createMCPServer({ registry });

    // Call custom action
    const callRes = await server.handleMessage({
      jsonrpc: "2.0",
      id: 20,
      method: "tools/call",
      params: {
        name: "calculate_fare",
        arguments: { distanceKm: 10 }
      }
    });

    assert.strictEqual(callRes.result.isError, false);
    const content = JSON.parse(callRes.result.content[0].text);
    assert.strictEqual(content.fare, 35);

    // Call oaw_list_actions
    const listRes = await server.handleMessage({
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: {
        name: "oaw_list_actions",
        arguments: {}
      }
    });
    assert.strictEqual(listRes.result.isError, false);
    const parsedList = JSON.parse(listRes.result.content[0].text);
    assert.strictEqual(parsedList.count, 1);
    assert.strictEqual(parsedList.actions[0].name, "calculate_fare");
  });

  test("loads repository site actions dynamically from site directory", async () => {
    const hubDir = resolve("../../sites/tripsteward-hub");
    const server = createMCPServer({ siteDirs: [hubDir] });
    await server.ready();

    const tools = server.getTools();
    const toolNames = tools.map(t => t.name);

    // Verify harborview / tripsteward actions got loaded
    assert.ok(toolNames.includes("get_trip_preferences"));
    assert.ok(toolNames.includes("reserve_hotel_room"));
    assert.ok(toolNames.includes("discover_agent_nodes"));

    // Call get_trip_preferences
    const callRes = await server.callTool("get_trip_preferences", {});
    assert.strictEqual(callRes.isError, false);
    const prefs = JSON.parse(callRes.content[0].text);
    assert.strictEqual(prefs.traveler.name, "Elena Rostova");
    assert.strictEqual(prefs.destination, "San Francisco, CA");
  });

  test("manages resources (audit-log and site manifests)", async () => {
    const server = createMCPServer();
    const resList = await server.handleMessage({
      jsonrpc: "2.0",
      id: 30,
      method: "resources/list"
    });

    const resources = resList.result.resources;
    assert.ok(resources.some(r => r.uri === "oaw://audit-log"));

    // Read audit log resource
    const readRes = await server.handleMessage({
      jsonrpc: "2.0",
      id: 31,
      method: "resources/read",
      params: { uri: "oaw://audit-log" }
    });

    assert.strictEqual(readRes.result.contents[0].uri, "oaw://audit-log");
    assert.strictEqual(readRes.result.contents[0].mimeType, "application/json");
  });

  test("handles unknown methods and error cases gracefully", async () => {
    const server = createMCPServer();

    // Unknown method
    const unknownRes = await server.handleMessage({
      jsonrpc: "2.0",
      id: 40,
      method: "non_existent_method"
    });
    assert.strictEqual(unknownRes.error.code, -32601);

    // Unknown tool
    const unknownTool = await server.handleMessage({
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: { name: "invalid_tool", arguments: {} }
    });
    assert.strictEqual(unknownTool.result.isError, true);
    assert.ok(unknownTool.result.content[0].text.includes("Unknown tool"));
  });
});
