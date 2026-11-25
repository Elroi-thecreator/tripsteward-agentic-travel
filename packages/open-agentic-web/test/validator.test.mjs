import assert from "node:assert";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateFederation, validateManifest, validateNetwork, validateNode } from "../src/validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

describe("Open Agentic Web - Conformance Validator", () => {
  it("validates manifest schema correctly", () => {
    const validManifest = {
      name: "test_node",
      networks: [
        { name: "test_net", front_man: "test_agent", hocon: "./net.json" }
      ],
      llm_router: { base_url: "https://api.otari.ai/api/v1" },
      actions: { agentTools: ["website_do_something"] }
    };

    const report = validateManifest(validManifest);
    assert.strictEqual(report.valid, true);
    assert.strictEqual(report.failed, 0);

    const invalidManifest = {
      name: "broken"
      // missing networks, llm_router
    };

    const badReport = validateManifest(invalidManifest);
    assert.strictEqual(badReport.valid, false);
    assert.ok(badReport.failed > 0);
  });

  it("validates declarative network graph correctly", () => {
    const validNet = {
      tools: [
        {
          name: "agent_concierge",
          instructions: "Grounded instructions for the concierge agent to act on behalf of the user.",
          function: {
            parameters: { type: "object", properties: { dest: { type: "string" } } }
          }
        }
      ]
    };

    const report = validateNetwork(validNet, { frontMan: "agent_concierge" });
    assert.strictEqual(report.valid, true);
  });

  it("validates live repository nodes (tripsteward-hub, cityglide-node, metropass-node)", async () => {
    const hubDir = join(repoRoot, "sites", "tripsteward-hub");
    const ridesDir = join(repoRoot, "sites", "cityglide-node");
    const expDir = join(repoRoot, "sites", "metropass-node");

    const hubSummary = await validateNode(hubDir);
    assert.strictEqual(hubSummary.valid, true, `tripsteward-hub failed: ${JSON.stringify(hubSummary.results.filter(r => r.status === 'FAIL'))}`);

    const ridesSummary = await validateNode(ridesDir);
    assert.strictEqual(ridesSummary.valid, true, `cityglide-node failed: ${JSON.stringify(ridesSummary.results.filter(r => r.status === 'FAIL'))}`);

    const expSummary = await validateNode(expDir);
    assert.strictEqual(expSummary.valid, true, `metropass-node failed: ${JSON.stringify(expSummary.results.filter(r => r.status === 'FAIL'))}`);

    // Test multi-node federation
    const fed = await validateFederation(hubDir, [ridesDir, expDir]);
    assert.strictEqual(fed.valid, true);
    assert.ok(fed.totalChecks > 30);
  });
});
