// HarborView Hotel & TripSteward Runtime Mount & Consent Controller
import { ChatFollow } from "./chat-follow.js";

function createCustomModalDialog({ title = "Action Authorization", message = "Authorize execution?", details = null, confirmText = "Authorize", cancelText = "Decline" } = {}) {
  if (typeof document === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.style.cssText = "border: 1px solid rgba(0,0,0,0.15); border-radius: 12px; padding: 22px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); max-width: 440px; width: 90%; font-family: system-ui, sans-serif; color: #0f172a; z-index: 999999;";
    dialog.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">${title}</h3>
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #475569; line-height: 1.4;">${message}</p>
      ${details ? `<pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; font-size: 11px; max-height: 120px; overflow: auto; margin-bottom: 14px;">${JSON.stringify(details, null, 2)}</pre>` : ''}
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button id="modal-cancel-btn" style="padding: 7px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px;">${cancelText}</button>
        <button id="modal-confirm-btn" style="padding: 7px 14px; border-radius: 6px; border: none; background: #0284c7; color: #fff; font-weight: 500; cursor: pointer; font-size: 13px;">${confirmText}</button>
      </div>
    `;
    const cleanup = (res) => {
      try { dialog.close(); } catch {}
      dialog.remove();
      resolve(res);
    };
    dialog.querySelector("#modal-cancel-btn").onclick = () => cleanup(false);
    dialog.querySelector("#modal-confirm-btn").onclick = () => cleanup(true);
    document.body.appendChild(dialog);
    try { dialog.showModal(); } catch { cleanup(true); }
  });
}

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
    if (AssistantMount.defaultReview) {
      try {
        return await AssistantMount.defaultReview(items);
      } catch {}
    }
    const first = Array.isArray(items) ? items[0] : items;
    const conf = AssistantMount.DIALOGS[first?.action || first?.name];
    return await createCustomModalDialog({
      title: conf ? conf.title : "Action Authorization",
      message: conf ? conf.sentence : "Authorize execution of autonomous action?",
      details: first?.arguments || first?.args || null
    });
  }

  static async reviewConsent(peer) {
    if (AssistantMount.defaultConsent) {
      try {
        return await AssistantMount.defaultConsent(peer);
      } catch {}
    }
    const label = peer?.peerLabel || peer?.peerOrigin || peer?.origin || "external provider";
    const ok = await createCustomModalDialog({
      title: "Federated Peer Consent",
      message: `Authorize TripSteward Concierge to query independent provider node '${label}' on your behalf?`,
      confirmText: "Allow Connection",
      cancelText: "Decline"
    });
    return ok ? "allow" : "decline";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  AssistantMount.start();
});
