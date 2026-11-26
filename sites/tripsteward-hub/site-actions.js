// HarborView Hotel & TripSteward Site Actions
// Exposes travel preferences, room booking, partner coordination, master itinerary synthesis,
// and dynamic Open Agentic Web node discovery & registration.
import { TripStewardApp } from "./script.js";

export function registerActions(actions) {
  return SiteActions.registerActions(actions);
}

export class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.getTripPreferencesAction());
    actions.register(SiteActions.reserveHotelRoomAction());
    actions.register(SiteActions.bookAirportTransferAction());
    actions.register(SiteActions.bookCityExperienceAction());
    actions.register(SiteActions.compileMasterItineraryAction());
    actions.register(SiteActions.discoverAgentNodesAction());
    actions.register(SiteActions.registerAgentNodeAction());
    actions.register(SiteActions.solveItineraryConstraintsAction());
  }

  static getTripPreferencesAction() {
    return {
      name: "get_trip_preferences",
      description: "Retrieve the active traveler profile and booking requirements (destination, check-in/out dates, party size, target budget, and special preferences) from sovereign browser memory.",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },
      execute: async () => {
        return TripStewardApp.vault.getActiveTrip();
      }
    };
  }

  static reserveHotelRoomAction() {
    return {
      name: "reserve_hotel_room",
      description: "Reserve a boutique hotel room at HarborView Hotel matching the traveler's dates and budget.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          room_tier: {
            type: "string",
            enum: ["Deluxe Bay-View Queen", "Urban Executive Loft", "Panoramic Harbor Penthouse"],
            description: "Selected room category."
          },
          nightly_rate_usd: {
            type: "number",
            description: "Nightly room rate in USD."
          },
          nights: {
            type: "integer",
            description: "Total number of nights."
          },
          guest_names: {
            type: "string",
            description: "Lead guest name."
          },
          amenities_included: {
            type: "array",
            items: { type: "string" },
            description: "Included perks (e.g. ['Complimentary Artisan Breakfast', 'High-Speed Wi-Fi', 'Late Check-out 1 PM'])."
          }
        },
        required: ["room_tier", "nightly_rate_usd", "nights", "guest_names", "amenities_included"],
        additionalProperties: false
      },
      execute: async (args) => {
        return TripStewardApp.vault.reserveHotelRoom(args);
      }
    };
  }

  static bookAirportTransferAction() {
    return {
      name: "book_airport_transfer",
      description: "Commit an airport chauffeur pickup reservation with partner network CityGlide Transfer.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          pickup_location: {
            type: "string",
            description: "Airport terminal or pickup point (e.g. 'SFO Terminal 2 - Flight UA 482')."
          },
          dropoff_location: {
            type: "string",
            description: "Destination address (e.g. 'HarborView Hotel, 450 Waterfront Blvd')."
          },
          vehicle_class: {
            type: "string",
            description: "Vehicle category (e.g. 'Executive EV Sedan', 'Chauffeur Luxury SUV')."
          },
          pickup_time: {
            type: "string",
            description: "Scheduled pickup time (synced with flight arrival buffer)."
          },
          fare_usd: {
            type: "number",
            description: "Guaranteed fixed transfer fare in USD."
          }
        },
        required: ["pickup_location", "dropoff_location", "vehicle_class", "pickup_time", "fare_usd"],
        additionalProperties: false
      },
      execute: async (args) => {
        return TripStewardApp.vault.bookAirportTransfer(args);
      }
    };
  }

  static bookCityExperienceAction() {
    return {
      name: "book_city_experience",
      description: "Commit timed admission or guided activity passes with partner network MetroPass Experiences.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          experience_name: {
            type: "string",
            description: "Title of experience (e.g. 'Golden Gate Sunset Catamaran Cruise', 'Modern Art VIP Pass')."
          },
          scheduled_slot: {
            type: "string",
            description: "Date and time window for the experience."
          },
          tickets_count: {
            type: "integer",
            description: "Number of tickets/passes reserved."
          },
          total_price_usd: {
            type: "number",
            description: "Total ticket price in USD."
          },
          special_notes: {
            type: "string",
            description: "Important booking or check-in instructions."
          }
        },
        required: ["experience_name", "scheduled_slot", "tickets_count", "total_price_usd", "special_notes"],
        additionalProperties: false
      },
      execute: async (args) => {
        return TripStewardApp.vault.bookCityExperience(args);
      }
    };
  }

  static compileMasterItineraryAction() {
    return {
      name: "compile_master_itinerary",
      description: "Synthesize all confirmed bookings (hotel room, airport transfer, and city experience passes) into a unified master travel pass with itemized pricing, savings, and QR confirmation vouchers.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          trip_title: {
            type: "string",
            description: "Summary title of the curated trip."
          },
          destination: {
            type: "string",
            description: "City and region of the trip."
          },
          dates: {
            type: "string",
            description: "Travel dates range."
          },
          total_cost_usd: {
            type: "number",
            description: "Total cost across all direct provider reservations."
          },
          direct_savings_usd: {
            type: "number",
            description: "Estimated savings compared to traditional 3rd-party aggregator markup."
          },
          itinerary_highlights: {
            type: "array",
            items: { type: "string" },
            description: "Key confirmed itinerary elements."
          },
          concierge_notes: {
            type: "string",
            description: "Special travel recommendations and arrival tips."
          }
        },
        required: ["trip_title", "destination", "dates", "total_cost_usd", "direct_savings_usd", "itinerary_highlights", "concierge_notes"],
        additionalProperties: false
      },
      execute: async (args) => {
        return TripStewardApp.vault.compileMasterItinerary(args);
      }
    };
  }

  static discoverAgentNodesAction() {
    return {
      name: "discover_agent_nodes",
      description: "Search the decentralized Open Agentic Web registry for available specialist nodes (mobility, dining, ski/adventures, baggage courier, travel insurance) matching traveler goals.",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword or capability to search (e.g. 'dining', 'ski', 'luggage', 'insurance', 'mobility')."
          },
          category: {
            type: "string",
            description: "Category filter (e.g. 'Dining', 'Adventures', 'Logistics', 'Insurance', 'Mobility')."
          }
        },
        additionalProperties: false
      },
      execute: async (args) => {
        return TripStewardApp.vault.searchAgents(args);
      }
    };
  }

  static registerAgentNodeAction() {
    return {
      name: "register_agent_node",
      description: "Dynamically mount and link an external agentic web node into the active orchestrator graph on the fly.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          node_url: {
            type: "string",
            description: "Endpoint URL of the conforming agent network (e.g. 'https://pnrs.is-a.dev/dining/tablebespoke_concierge')."
          },
          name: {
            type: "string",
            description: "Display brand name of the agent node."
          },
          front_man: {
            type: "string",
            description: "Front-man agent identifier declared in the node manifest."
          },
          category: {
            type: "string",
            description: "Domain capability of the agent."
          }
        },
        required: ["node_url"],
        additionalProperties: false
      },
      execute: async (args) => {
        return TripStewardApp.vault.addAgentOnTheFly(args);
      }
    };
  }

  static solveItineraryConstraintsAction() {
    return {
      name: "solve_itinerary_constraints",
      description: "Mathematical & temporal constraint solver. Detects impossibilities between flight arrival, baggage claim buffers, chauffeur transit, activity boarding times, and vehicle passenger capacity limits. Autonomously returns optimal replanned schedules.",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          flight_arrival_time: { type: "string", description: "Flight landing time (e.g. '4:30 PM')." },
          baggage_buffer_minutes: { type: "integer", description: "Deplaning & baggage buffer minutes (default 30)." },
          transit_minutes: { type: "integer", description: "Transit time to hotel (default 28)." },
          party_size: { type: "integer", description: "Number of travelers." },
          target_budget_usd: { type: "number", description: "Target traveler budget in USD." },
          proposed_activity_name: { type: "string", description: "Activity name (e.g. 'Golden Gate Sunset Catamaran Cruise')." },
          proposed_activity_time: { type: "string", description: "Scheduled activity time (e.g. '5:45 PM')." },
          proposed_activity_day: { type: "string", description: "Day of activity (e.g. 'Friday')." }
        },
        additionalProperties: false
      },
      execute: async (args = {}) => {
        const flightTime = args.flight_arrival_time || "4:30 PM";
        const baggageBuffer = args.baggage_buffer_minutes || 30;
        const transitMinutes = args.transit_minutes || 28;
        const partySize = args.party_size || 2;
        const activityTime = args.proposed_activity_time || "5:45 PM";
        const activityDay = args.proposed_activity_day || "Friday";

        // Parse flight time into minutes from midnight
        const match = flightTime.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
        let flightMinutes = 16 * 60 + 30; // default 4:30 PM = 990
        if (match) {
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const mer = match[3]?.toUpperCase();
          if (mer === "PM" && h < 12) h += 12;
          if (mer === "AM" && h === 12) h = 0;
          flightMinutes = h * 60 + m;
        }

        const pickupMinutes = flightMinutes + baggageBuffer;
        const hotelArrivalMinutes = pickupMinutes + transitMinutes;
        const hotelArrivalH = Math.floor(hotelArrivalMinutes / 60);
        const hotelArrivalM = hotelArrivalMinutes % 60;
        const hotelArrivalStr = `${hotelArrivalH > 12 ? hotelArrivalH - 12 : hotelArrivalH}:${hotelArrivalM < 10 ? '0' : ''}${hotelArrivalM} PM`;

        // Check activity time
        const actMatch = activityTime.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
        let actMinutes = 17 * 60 + 45; // default 5:45 PM = 1065
        if (actMatch) {
          let h = parseInt(actMatch[1], 10);
          const m = parseInt(actMatch[2], 10);
          const mer = actMatch[3]?.toUpperCase();
          if (mer === "PM" && h < 12) h += 12;
          if (mer === "AM" && h === 12) h = 0;
          actMinutes = h * 60 + m;
        }

        // Required arrival buffer before activity boarding is at least 35 minutes after hotel arrival
        const earliestSafeActivityMinutes = hotelArrivalMinutes + 35;
        const isTemporalConflict = (activityDay.toLowerCase() === "friday" || activityDay.toLowerCase().includes("arrival")) && actMinutes < earliestSafeActivityMinutes;

        // Vehicle capacity constraint
        const isCapacityConflict = partySize > 3;

        const replannedSchedule = {
          flight_arrival: flightTime,
          chauffeur_pickup: `${Math.floor(pickupMinutes / 60) > 12 ? Math.floor(pickupMinutes / 60) - 12 : Math.floor(pickupMinutes / 60)}:${pickupMinutes % 60 < 10 ? '0' : ''}${pickupMinutes % 60} PM`,
          estimated_hotel_arrival: hotelArrivalStr,
          recommended_vehicle: isCapacityConflict ? "Luxury Chauffeur SUV (Rivian R1S / Escalade - Capacity: 6)" : "Executive EV Sedan (Lucid Air - Capacity: 3)",
          rescheduled_activity: {
            name: args.proposed_activity_name || "Golden Gate Sunset Catamaran Cruise",
            original_time: `${activityDay} ${activityTime}`,
            replanned_time: isTemporalConflict ? "Saturday 5:45 PM" : `${activityDay} ${activityTime}`,
            status: isTemporalConflict ? "REPLANNED_AVOID_CONFLICT" : "FEASIBLE"
          }
        };

        return {
          ok: true,
          solver_version: "2.1.0-sandboxed",
          has_conflicts: isTemporalConflict || isCapacityConflict,
          temporal_conflict: isTemporalConflict,
          capacity_conflict: isCapacityConflict,
          conflict_analysis: isTemporalConflict
            ? `Temporal impossibility: Flight arrives at ${flightTime}. With ${baggageBuffer}m baggage buffer and ${transitMinutes}m transit, estimated hotel check-in is ${hotelArrivalStr}. Activity at ${activityTime} with required early boarding cannot be safely reached on arrival night.`
            : "No temporal conflicts detected.",
          capacity_analysis: isCapacityConflict
            ? `Party size of ${partySize} exceeds 3-passenger sedan capacity. Upgraded to Luxury Chauffeur SUV.`
            : `Party size of ${partySize} fits within Executive EV Sedan capacity (3 max).`,
          replanned_schedule: replannedSchedule,
          recommendations: [
            isTemporalConflict ? "Shift Sunset Catamaran Cruise from Friday evening to Saturday 5:45 PM to guarantee stress-free boarding." : "Schedule is temporally feasible.",
            isCapacityConflict ? "Select Luxury Chauffeur SUV ($108.00) to safely accommodate all 4 guests with full luggage capacity." : "Select Executive EV Sedan ($68.00)."
          ]
        };
      }
    };
  }
}
