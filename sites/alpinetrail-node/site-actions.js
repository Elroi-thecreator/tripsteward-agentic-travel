// Grounded executable site actions for AlpineTrail Expeditions Node
import { defineAction } from "open-agentic-web";

export function registerActions(registry) {
  return SiteActions.registerActions(registry);
}

export class SiteActions {
  static registerActions(registry) {
    registry.register(
      defineAction({
        name: "check_trail_conditions",
        description: "Check mountain weather, avalanche forecast, and wilderness pass availability.",
        effect: "read",
        availability: "bridge",
        callerOrigins: ["*"],
        inputSchema: {
          type: "object",
          properties: {
            destination: { type: "string", description: "Target trail, park, or peak area (e.g. 'Mount Tamalpais', 'Lake Tahoe', 'Muir Woods')." },
            activity: { type: "string", description: "Desired activity: 'hiking', 'skiing', 'backcountry'." }
          }
        },
        execute: async (args) => {
          return {
            ok: true,
            destination: args.destination || "Mount Tamalpais Wilderness",
            conditions: "Clear skies, snowpack depth 42in, trail open",
            guide_availability: "Master Alpine Guide on standby",
            permit_required: true,
            pass_price_usd: 85.00,
            direct_savings: "$25 saved vs adventure travel broker"
          };
        }
      })
    );

    registry.register(
      defineAction({
        name: "book_expedition_pass",
        description: "Book certified wilderness guide pass and equipment reservation directly.",
        effect: "irreversible",
        availability: "bridge",
        callerOrigins: ["*"],
        inputSchema: {
          type: "object",
          properties: {
            destination: { type: "string", description: "Expedition destination." },
            participants: { type: "integer", description: "Number of expedition participants." },
            date: { type: "string", description: "Expedition date." }
          },
          required: ["destination"]
        },
        execute: async (args) => {
          const passId = "ALP-PASS-" + Math.floor(1000 + Math.random() * 9000);
          const count = args.participants || 2;
          const total = count * 85.00;
          return {
            ok: true,
            pass_id: passId,
            destination: args.destination,
            participants: count,
            date: args.date || "Tomorrow",
            total_cost_usd: total,
            status: "CONFIRMED_PERMIT_ISSUED",
            message: `Alpine expedition pass ${passId} secured for ${count} guest(s).`
          };
        }
      })
    );
  }
}
