// HarborView Hotel & TripSteward Runtime Mount & Consent Controller
import { ChatFollow } from "./chat-follow.js";

export class AssistantMount {
  static GREETING = "I am your autonomous Travel Concierge at HarborView Hotel & TripSteward. I operate entirely within your local browser memory to coordinate room reservations, airport chauffeur pickups, and VIP activity passes directly across independent service providers on the Open Agentic Web. How can I assist with your journey?";

  static DIALOGS = {
    "reserve_hotel_room": {
      title: "Confirm Direct Hotel Room Reservation?",
      sentence: "This will commit a direct room reservation at HarborView Hotel matching your travel dates and lock in your direct rate.",
      confirm: "Authorize Room Reservation",
      decline: "Review Options"
    },
    "book_airport_transfer": {
      title: "Authorize CityGlide Airport Transfer?",
      sentence: "This will dispatch a flight-tracked airport transfer with CityGlide to meet you upon arrival.",
      confirm: "Authorize Airport Transfer",
      decline: "Skip Transfer"
    },
    "book_city_experience": {
      title: "Secure MetroPass Activity Tickets?",
      sentence: "This will reserve timed admission tickets with partner network MetroPass.",
      confirm: "Secure Experience Passes",
      decline: "Review Passes"
    },
    "compile_master_itinerary": {
      title: "Seal Master Digital Travel Pass?",
      sentence: "This will compile your hotel stay, ground transfer, and activity passes into a sealed master travel pass with direct provider savings.",
      confirm: "Seal Master Itinerary",
      decline: "Modify Itinerary"
    }
  };

  static async start() {
    const status = document.querySelector("#assistant-status");
    const siteBase = new URL("./", import.meta.url).href;
    try {
      const { boot } = await import("./runtime/index.js");
      const booted = await boot("#agent-app", {
        originUrl: siteBase,
        sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
      });

      AssistantMount.engine = booted.engine;

      // Hook action review
      AssistantMount.defaultReview = booted.engine.onActionConfirm;
      booted.engine.onActionConfirm = AssistantMount.reviewAction;

      // Hook peer consent
      AssistantMount.defaultConsent = booted.engine.onConsent;
      booted.engine.onConsent = AssistantMount.reviewConsent;

      ChatFollow.start(document.querySelector("#agent-app"));

      const needsKey = !booted.engine.mockLLM
        && (!booted.engine.byokKey || booted.engine.byokKey === "demo");
      if (status) {
        status.textContent = needsKey
          ? "TripSteward Concierge ready. Enter your Mozilla Otari or AI provider key in the settings panel below."
          : "TripSteward Concierge active & connected to provider nodes.";
      }
      if (!needsKey) {
        AssistantMount.greet();
      }
      return booted.engine;
    } catch (error) {
      if (status) {
        status.textContent = "Autonomous assistant loaded in fallback mode.";
      }
      console.warn("TripSteward concierge startup note:", error);
      return null;
    }
  }

  static greet() {
    const first = document.querySelector("#ns-msgs .ns-msg.bot");
    if (first) {
      first.textContent = AssistantMount.GREETING;
    }
  }

  static async reviewAction(items) {
    const first = Array.isArray(items) ? items[0] : items;
    const conf = AssistantMount.DIALOGS[first?.action || first?.name];
    if (!conf) return AssistantMount.defaultReview ? AssistantMount.defaultReview(items) : true;
    return window.confirm(`${conf.title}\n\n${conf.sentence}\n\nClick OK to '${conf.confirm}' or Cancel to '${conf.decline}'.`);
  }

  static async reviewConsent(peer) {
    const label = peer?.peerLabel || peer?.peerOrigin || peer?.origin || "external provider";
    return window.confirm(`Authorize TripSteward Concierge to query independent provider node '${label}' on your behalf?`)
      ? "allow"
      : "decline";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  AssistantMount.start();
});
