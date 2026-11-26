// CityGlide Autonomous Fleet Site Actions
// Exposes fleet status, transfer quotes, and airport ride scheduling for the Open Agentic Web.
import { CityGlideApp } from "./script.js";

export function registerActions(actions) {
  return SiteActions.registerActions(actions);
}

export class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.quoteTransferServiceAction());
    actions.register(SiteActions.scheduleAirportTransferAction());
    actions.register(SiteActions.getFleetStatusAction());
  }

  static quoteTransferServiceAction() {
    return {
      name: "quote_transfer_service",
      description: "Calculate direct airport transfer options, flight delay buffers, and vehicle classes (Executive EV Sedan, Luxury Chauffeur SUV).",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "Dropoff location or hotel (e.g. 'HarborView Hotel, 450 Waterfront Blvd')."
          },
          pickup_time: {
            type: "string",
            description: "Requested time or flight arrival timestamp (e.g. '4:30 PM')."
          },
          flight_number: {
            type: "string",
            description: "Incoming flight number for automatic landing tracking (e.g. 'UA 482')."
          },
          passengers: {
            type: "integer",
            description: "Number of passengers needing ground transit."
          },
          airport_code: {
            type: "string",
            description: "Airport code (e.g. 'SFO', 'SEA', 'AUS')."
          }
        },
        required: ["destination"],
        additionalProperties: false
      },
      execute: async (args) => {
        return CityGlideApp.vault.quoteService(args);
      }
    };
  }

  static scheduleAirportTransferAction() {
    return {
      name: "schedule_airport_transfer",
      description: "Dispatch and reserve an airport ground transfer chauffeur with flight delay tracking.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          vehicle_class: {
            type: "string",
            description: "Selected vehicle class ('Executive EV Sedan' or 'Luxury Chauffeur SUV')."
          },
          passenger_name: {
            type: "string",
            description: "Lead passenger full name."
          },
          pickup_location: {
            type: "string",
            description: "Airport terminal or pickup spot (e.g. 'SFO Terminal 2 Curbside')."
          },
          dropoff_location: {
            type: "string",
            description: "Destination address (e.g. 'HarborView Hotel, 450 Waterfront Blvd')."
          },
          pickup_time: {
            type: "string",
            description: "Scheduled pickup time (accounting for baggage buffer)."
          },
          flight_number: {
            type: "string",
            description: "Flight number for live telemetry."
          },
          fare_usd: {
            type: "number",
            description: "Agreed direct transfer rate in USD."
          }
        },
        required: ["vehicle_class", "passenger_name", "pickup_location", "dropoff_location", "pickup_time"],
        additionalProperties: false
      },
      execute: async (args) => {
        return CityGlideApp.vault.scheduleTransfer(args);
      }
    };
  }

  static getFleetStatusAction() {
    return {
      name: "get_fleet_status",
      description: "Query current vehicle availability, battery charge levels, and driver readiness at airport hubs.",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          hub: {
            type: "string",
            description: "Airport hub code (e.g. 'SFO', 'SEA', 'AUS')."
          }
        },
        additionalProperties: false
      },
      execute: async () => {
        return CityGlideApp.vault.getFleetStatus();
      }
    };
  }
}
