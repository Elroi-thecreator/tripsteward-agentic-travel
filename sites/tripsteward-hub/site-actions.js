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
}
