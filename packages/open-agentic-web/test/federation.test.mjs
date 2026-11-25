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
});
