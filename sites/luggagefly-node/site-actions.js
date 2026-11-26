// Grounded executable site actions for LuggageFly Logistics Node
import { defineAction } from "open-agentic-web";

export function registerActions(registry) {
  return SiteActions.registerActions(registry);
}

export class SiteActions {
  static registerActions(registry) {
    registry.register(
      defineAction({
        name: "track_luggage",
        description: "Query luggage courier availability, pickup zones, and delivery estimates.",
        effect: "read",
        availability: "bridge",
        callerOrigins: ["*"],
        inputSchema: {
          type: "object",
          properties: {
            airport_code: { type: "string", description: "Airport code (e.g. 'SFO', 'OAK', 'SJC')." },
            bags_count: { type: "integer", description: "Number of bags." }
          }
        },
        execute: async (args) => {
          const bags = args.bags_count || 2;
          return {
            ok: true,
            airport: args.airport_code || "SFO",
            bags: bags,
            rate_usd: 35.00 * bags,
            estimated_hotel_delivery: "90 minutes after landing",
            curbside_porter_included: true,
            direct_savings: "$20 saved vs hotel concierge fee"
          };
        }
      })
    );

    registry.register(
      defineAction({
        name: "schedule_baggage_transfer",
        description: "Dispatch courier to collect luggage at carousel and deliver directly to hotel room.",
        effect: "irreversible",
        availability: "bridge",
        callerOrigins: ["*"],
        inputSchema: {
          type: "object",
          properties: {
            passenger_name: { type: "string", description: "Traveler full name." },
            hotel_address: { type: "string", description: "Destination hotel name and address." },
            flight_number: { type: "string", description: "Flight number for baggage claim synchronization." },
            bags_count: { type: "integer", description: "Number of bags." }
          },
          required: ["hotel_address"]
        },
        execute: async (args) => {
          const trackingId = "LF-BAG-" + Math.floor(1000 + Math.random() * 9000);
          const bags = args.bags_count || 2;
          const total = bags * 35.00;
          return {
            ok: true,
            tracking_id: trackingId,
            passenger_name: args.passenger_name || "Guest Traveler",
            hotel_address: args.hotel_address,
            flight_number: args.flight_number || "UA 482",
            bags: bags,
            total_cost_usd: total,
            status: "COURIER_DISPATCHED",
            message: `LuggageFly courier dispatched for ${bags} bag(s). Tracking ID: ${trackingId}.`
          };
        }
      })
    );
  }
}
