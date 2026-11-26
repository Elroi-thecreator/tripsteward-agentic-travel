// MetroPass Experiences & City Curations Site Actions
// Exposes activity search, digital pass booking, and live ticket vault for the Open Agentic Web.
import { MetroPassApp } from "./script.js";

export function registerActions(actions) {
  return SiteActions.registerActions(actions);
}

export class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.searchExperiencesAction());
    actions.register(SiteActions.bookExperiencePassAction());
    actions.register(SiteActions.getAvailableCatalogAction());
  }

  static searchExperiencesAction() {
    return {
      name: "search_experiences",
      description: "Search curated city experiences, sunset cruises, museum VIP passes, and culinary tours.",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City name (e.g. 'San Francisco', 'Seattle', 'Austin')."
          },
          category: {
            type: "string",
            description: "Category filter (e.g. 'sailing', 'museum', 'culinary', 'adventure', 'all')."
          },
          max_price: {
            type: "number",
            description: "Maximum budget per ticket in USD."
          }
        },
        additionalProperties: false
      },
      execute: async (args) => {
        return MetroPassApp.vault.searchExperiences(args);
      }
    };
  }

  static bookExperiencePassAction() {
    return {
      name: "book_experience_pass",
      description: "Issue and reserve verified digital admission tickets or activity passes with direct provider confirmation.",
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {
          experience_id: {
            type: "string",
            description: "Catalog identifier (e.g. 'EXP-SF-01')."
          },
          attendee_name: {
            type: "string",
            description: "Lead attendee full name."
          },
          date: {
            type: "string",
            description: "Activity date (e.g. 'Saturday, Nov 28')."
          },
          tickets: {
            type: "integer",
            description: "Number of admission passes requested."
          }
        },
        required: ["experience_id", "attendee_name"],
        additionalProperties: false
      },
      execute: async (args) => {
        return MetroPassApp.vault.bookPass(args);
      }
    };
  }

  static getAvailableCatalogAction() {
    return {
      name: "get_available_catalog",
      description: "Query full verified activity catalog and seasonal city highlights.",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },
      execute: async () => {
        return MetroPassApp.vault.getCatalog();
      }
    };
  }
}
