export class SiteActions {
  static registerActions(registry) {
    registry.register({
      name: "query_traveler_profile",
      description: "Retrieve active traveler preferences",
      effect: "read",
      inputSchema: { type: "object", properties: {} },
      execute: async () => ({ destination: "San Francisco", budget: 500 })
    });
    registry.register({
      name: "reserve_hub_package",
      description: "Confirm hotel booking package",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        properties: { nights: { type: "integer" } },
        required: ["nights"]
      },
      execute: async (args) => ({ confirmed: true, booking_id: "HUB-123" })
    });
  }
}
