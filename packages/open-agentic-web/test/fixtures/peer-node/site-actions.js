export function registerActions(registry) {
  return SiteActions.registerActions(registry);
}

export class SiteActions {
  static registerActions(registry) {
    registry.register({
      name: "quote_ground_transit",
      description: "Quote ground transit transfer rates",
      effect: "read",
      availability: "bridge",
      callerOrigins: ["*"],
      inputSchema: { type: "object", properties: { origin: { type: "string" } } },
      execute: async () => ({ fare: 50, vehicle: "Sedan" })
    });
  }
}
