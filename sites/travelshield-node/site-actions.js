// Grounded executable site actions for TravelShield Protection Node
import { defineAction } from "open-agentic-web";

export function registerActions(registry) {
  return SiteActions.registerActions(registry);
}

export class SiteActions {
  static registerActions(registry) {
    registry.register(
      defineAction({
        name: "quote_travel_policy",
        description: "Calculate instant parametric flight delay coverage with direct payout.",
        effect: "read",
        availability: "bridge",
        callerOrigins: ["*"],
        inputSchema: {
          type: "object",
          properties: {
            flight_number: { type: "string", description: "Flight number (e.g. 'UA 482')." },
            destination: { type: "string", description: "Destination city or airport." }
          }
        },
        execute: async (args) => {
          return {
            ok: true,
            flight: args.flight_number || "UA 482",
            coverage: "Parametric Flight Delay Guarantee ($250 instant payout upon 45+ min arrival delay)",
            premium_usd: 19.00,
            underwriting_decision: "AUTOMATICALLY_APPROVED",
            direct_savings: "$35 saved vs traditional travel insurance plan"
          };
        }
      })
    );

    registry.register(
      defineAction({
        name: "file_instant_claim",
        description: "Bind and issue parametric flight delay guarantee policy.",
        effect: "irreversible",
        availability: "bridge",
        callerOrigins: ["*"],
        inputSchema: {
          type: "object",
          properties: {
            traveler_name: { type: "string", description: "Name of insured traveler." },
            flight_number: { type: "string", description: "Flight number to monitor." },
            payout_destination: { type: "string", description: "Direct payout destination or wallet." }
          },
          required: ["flight_number"]
        },
        execute: async (args) => {
          const policyId = "TS-POL-" + Math.floor(1000 + Math.random() * 9000);
          return {
            ok: true,
            policy_id: policyId,
            insured_traveler: args.traveler_name || "Guest Traveler",
            flight_number: args.flight_number,
            premium_paid_usd: 19.00,
            payout_amount_usd: 250.00,
            delay_trigger_minutes: 45,
            status: "ACTIVE_PARAMETRIC_MONITORING",
            message: `Policy ${policyId} active for flight ${args.flight_number}. Automated radar monitoring enabled.`
          };
        }
      })
    );
  }
}
