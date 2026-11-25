import assert from "node:assert";
import { describe, it } from "node:test";
import { AgentSwarm } from "../src/federation.js";

describe("Open Agentic Web - Dynamic Swarm & Federation", () => {
  it("registers, searches, and unregisters nodes on the fly", () => {
    const swarm = new AgentSwarm();

    swarm.registerNode({
      id: "dining_sommelier",
      name: "TableBespoke Dining",
      category: "Dining",
      front_man: "sommelier",
      tools: ["website_reserve_table", "website_check_menu"],
      description: "Michelin table priority reservations"
    });

    swarm.registerNode({
      id: "ski_passes",
      name: "AlpineTrail Expeditions",
      category: "Adventures",
      front_man: "mountain_ranger",
      tools: ["website_book_ski_pass"],
      description: "Backcountry ski passes and guides"
    });

    assert.strictEqual(swarm.getNodes().length, 2);

    // Search by category
    const diningResults = swarm.search({ category: "Dining" });
    assert.strictEqual(diningResults.length, 1);
    assert.strictEqual(diningResults[0].id, "dining_sommelier");

    // Search by query keyword
    const skiResults = swarm.search({ query: "ski" });
    assert.strictEqual(skiResults.length, 1);
    assert.strictEqual(skiResults[0].id, "ski_passes");

    // Export links format
    const links = swarm.exportLinks("my_orchestrator");
    assert.ok(links.networks.my_orchestrator.dining_sommelier !== undefined);

    // Unregister
    const removed = swarm.unregisterNode("dining_sommelier");
    assert.strictEqual(removed, true);
    assert.strictEqual(swarm.getNodes().length, 1);
  });

  it("mounts node with user consent hook", async () => {
    const swarm = new AgentSwarm();

    const mockManifest = {
      name: "travel_shield",
      description: "TravelShield Parametric Insurance",
      category: "Insurance",
      networks: [{ front_man: "insurance_agent" }],
      actions: { agentTools: ["website_quote_policy"] }
    };

    const mockFetch = async () => ({
      ok: true,
      json: async () => mockManifest
    });

    let consentPrompted = false;
    const consentHook = async ({ candidate }) => {
      consentPrompted = true;
      assert.strictEqual(candidate.id, "travel_shield");
      return true; // Approve
    };

    const mounted = await swarm.mountFromUrl("https://example.com/shield", {
      fetchFn: mockFetch,
      onConsent: consentHook
    });

    assert.strictEqual(consentPrompted, true);
    assert.strictEqual(mounted.id, "travel_shield");
    assert.strictEqual(swarm.getNodes().length, 1);
  });

  it("formats tools and runs autonomous turn with tool execution", async () => {
    const swarm = new AgentSwarm({
      defaultRouter: "mock",
      defaultModel: "alibaba/qwen3.8-flash"
    });

    swarm.registerNode({
      id: "rides",
      name: "CityGlide Rides",
      category: "Mobility",
      tools: [
        {
          name: "website_quote_ride",
          description: "Get ride fare estimate",
          inputSchema: { type: "object", properties: { destination: { type: "string" } } }
        }
      ]
    });

    const openaiTools = swarm.getOpenAITools();
    assert.strictEqual(openaiTools.length, 1);
    assert.strictEqual(openaiTools[0].function.name, "website_quote_ride");

    let actionExecuted = false;
    const turnResult = await swarm.runTurn({
      prompt: "Please book a ride to the hotel",
      apiKey: "mock",
      actionExecutor: async (tool, args) => {
        actionExecuted = true;
        assert.strictEqual(tool, "website_quote_ride");
        return { fare_usd: 45, status: "DISPATCHED" };
      }
    });

    assert.strictEqual(turnResult.ok, true);
    assert.strictEqual(actionExecuted, true);
    assert.strictEqual(turnResult.toolCallsCount, 1);
    assert.ok(turnResult.text.includes("website_quote_ride"));
  });

  it("searches hydrated tool objects without crashing and finds tools by description", () => {
    const swarm = new AgentSwarm();
    swarm.registerNode({
      id: "node_hydrated",
      name: "Hydrated Node",
      category: "Services",
      tools: [
        {
          name: "website_check_availability",
          description: "Inspect live catamaran sunset cruises"
        }
      ]
    });

    // Search by tool description query keyword
    const results = swarm.search({ query: "catamaran" });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "node_hydrated");

    // Search by tool name
    const resultsByName = swarm.search({ query: "availability" });
    assert.strictEqual(resultsByName.length, 1);
  });

  it("auto-namespaces tools on cross-peer collision and strips prefix before execution", async () => {
    const swarm = new AgentSwarm({
      defaultRouter: "mock",
      defaultModel: "alibaba/qwen3.8-flash"
    });

    swarm.registerNode({
      id: "node_a",
      name: "Provider A",
      category: "Inventory",
      tools: [{ name: "website_query_inventory", description: "Query Provider A stock" }]
    });

    swarm.registerNode({
      id: "node_b",
      name: "Provider B",
      category: "Inventory",
      tools: [{ name: "website_query_inventory", description: "Query Provider B stock" }]
    });

    const tools = swarm.getOpenAITools();
    assert.strictEqual(tools.length, 2);
    // Both function names should be namespaced to prevent 400 Duplicate function name error
    const names = tools.map(t => t.function.name);
    assert.ok(names.includes("node_a__website_query_inventory"));
    assert.ok(names.includes("node_b__website_query_inventory"));

    // Tool resolution strips the prefix
    const resolved = swarm.resolveTool("node_a__website_query_inventory");
    assert.strictEqual(resolved.rawName, "website_query_inventory");
    assert.strictEqual(resolved.nodeId, "node_a");

    // In runTurn mock mode, actionExecutor receives the stripped raw tool name
    let receivedToolName = null;
    let receivedMeta = null;
    await swarm.runTurn({
      prompt: "book inventory now",
      apiKey: "mock",
      actionExecutor: async (tool, args, meta) => {
        receivedToolName = tool;
        receivedMeta = meta;
        return { ok: true };
      }
    });

    assert.strictEqual(receivedToolName, "website_query_inventory");
    assert.ok(receivedMeta?.nodeId === "node_a" || receivedMeta?.nodeId === "node_b");
  });
});
