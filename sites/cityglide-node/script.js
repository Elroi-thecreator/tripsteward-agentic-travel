// CityGlide Autonomous Fleet & Airport Transfers UI & Dispatch Vault

function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class CityGlideApp {
  static vault = {
    fleet: [
      {
        id: "CG-FLEET-01",
        model: "Lucid Air Grand Touring",
        type: "Executive EV Sedan",
        driver: "Marcus Vance",
        rating: 4.98,
        trips: 1420,
        battery: "94%",
        status: "Available",
        hub: "SFO Curbside Express",
        rate_usd: 68
      },
      {
        id: "CG-FLEET-02",
        model: "Tesla Model S Plaid",
        type: "Executive EV Sedan",
        driver: "Elena Rostova",
        rating: 4.99,
        trips: 2180,
        battery: "88%",
        status: "Dispatched",
        hub: "SFO International",
        rate_usd: 68
      },
      {
        id: "CG-FLEET-03",
        model: "Rivian R1S Chauffeur Edition",
        type: "Luxury Chauffeur SUV",
        driver: "Derrick Hayes",
        rating: 4.96,
        trips: 980,
        battery: "91%",
        status: "Available",
        hub: "SFO T2 Curbside",
        rate_usd: 108
      },
      {
        id: "CG-FLEET-04",
        model: "Cadillac Escalade IQ",
        type: "Luxury Chauffeur SUV",
        driver: "Aria Thorne",
        rating: 4.97,
        trips: 1140,
        battery: "85%",
        status: "Available",
        hub: "SEA-Tac Priority",
        rate_usd: 108
      }
    ],

    reservations: [
      {
        transfer_id: "CG-TRANS-5012",
        passenger_name: "Dr. Rachel Chen",
        vehicle_class: "Executive EV Sedan",
        driver: "Elena Rostova (Tesla Model S)",
        pickup_location: "SFO Terminal 2 - Baggage Carousel 4",
        dropoff_location: "HarborView Hotel, 450 Waterfront Blvd",
        pickup_time: "5:00 PM (UA 482 flight buffer)",
        fare_usd: 68,
        status: "CONFIRMED_DISPATCHED",
        created_at: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ],

    calculateArrivalBuffer(timeStr, flightNumber = "") {
      if (!timeStr) return "5:00 PM (+30 min flight arrival buffer)";
      const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
      if (!match) {
        return `${timeStr} (+30 min flight arrival buffer)`;
      }

      let hours = parseInt(match[1], 10);
      let minutes = parseInt(match[2], 10);
      const hasMeridiem = !!match[3];
      const meridiem = match[3] ? match[3].toUpperCase() : null;

      // Determine buffer: domestic 30m, international 45m
      const isInternational = flightNumber && (flightNumber.startsWith("BA") || flightNumber.startsWith("LH") || flightNumber.startsWith("AF") || flightNumber.startsWith("JL") || flightNumber.startsWith("CX") || flightNumber.startsWith("SQ"));
      const bufferMinutes = isInternational ? 45 : 30;

      // Convert to 24-hour scale for proper arithmetic across noon/midnight
      if (hasMeridiem) {
        if (meridiem === "PM" && hours < 12) {
          hours += 12;
        } else if (meridiem === "AM" && hours === 12) {
          hours = 0;
        }
      }

      minutes += bufferMinutes;
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
      hours = hours % 24;

      const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
      let formattedTime = "";
      if (hasMeridiem) {
        const outMeridiem = hours >= 12 ? "PM" : "AM";
        let displayHours = hours % 12;
        if (displayHours === 0) displayHours = 12;
        formattedTime = `${displayHours}:${formattedMinutes} ${outMeridiem}`;
      } else {
        formattedTime = `${hours}:${formattedMinutes}`;
      }

      return `${formattedTime} (+${bufferMinutes} min flight arrival buffer)`;
    },

    quoteService(args) {
      const passengers = args.passengers || 2;
      const flight = args.flight_number || "UA 482";
      const recommendedPickup = this.calculateArrivalBuffer(args.pickup_time || "4:30 PM", flight);

      return {
        origin: args.airport_code ? `${args.airport_code} Airport` : "SFO Terminal 2",
        destination: args.destination || "HarborView Hotel, 450 Waterfront Blvd",
        flight_number: flight,
        calculated_pickup_time: recommendedPickup,
        estimated_transit_minutes: 28,
        distance_miles: 14.8,
        options: [
          {
            vehicle_class: "Executive EV Sedan",
            models: "Lucid Air Grand Touring / Tesla Model S",
            capacity: "1-3 passengers, 2 bags",
            fare_usd: 68.00,
            features: ["Flight landing tracking", "Complimentary 45-min delay buffer", "Curbside meet & greet", "In-car Wi-Fi & Fiji water"]
          },
          {
            vehicle_class: "Luxury Chauffeur SUV",
            models: "Rivian R1S / Cadillac Escalade IQ",
            capacity: "1-6 passengers, 5 bags",
            fare_usd: 108.00,
            features: ["VIP curbside porter service", "Panoramic glass canopy", "Child seat on request", "Guaranteed quiet cabin mode"]
          }
        ],
        agent_note: passengers > 3 ? "Recommended: Luxury Chauffeur SUV for party size." : "Recommended: Executive EV Sedan for direct waterfront transit."
      };
    },

    scheduleTransfer(args) {
      const id = "CG-TRANS-" + Math.floor(1000 + Math.random() * 9000);
      const matchedDriver = args.vehicle_class?.includes("SUV") 
        ? "Derrick Hayes (Rivian R1S Chauffeur #03)"
        : "Marcus Vance (Lucid Air Grand Touring #01)";

      const res = {
        transfer_id: id,
        passenger_name: args.passenger_name || "Guest Traveler",
        vehicle_class: args.vehicle_class || "Executive EV Sedan",
        driver: matchedDriver,
        pickup_location: args.pickup_location || "SFO Terminal 2 Curbside",
        dropoff_location: args.dropoff_location || "HarborView Hotel, 450 Waterfront Blvd",
        pickup_time: args.pickup_time || "5:00 PM",
        flight_number: args.flight_number || "UA 482",
        fare_usd: args.fare_usd || (args.vehicle_class?.includes("SUV") ? 108 : 68),
        status: "CONFIRMED_DISPATCHED",
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      this.reservations.unshift(res);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("oaw_cityglide_reservations", JSON.stringify(this.reservations));
        }
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel("oaw_provider_events");
          ch.postMessage({ type: "cityglide_transfer_scheduled", reservation: res });
          ch.close();
        }
      } catch (e) {
        console.warn("Storage/Broadcast error:", e);
      }
      CityGlideApp.renderReservations();
      return {
        success: true,
        transfer_id: res.transfer_id,
        driver_assigned: res.driver,
        pickup_window: res.pickup_time,
        fare_usd: res.fare_usd,
        status: res.status,
        confirmation_message: `Chauffeur dispatched for ${res.passenger_name}. Your driver will meet you at ${res.pickup_location} at ${res.pickup_time}.`
      };
    },

    getFleetStatus(args = {}) {
      const hubFilter = args?.hub ? args.hub.trim().toUpperCase() : null;
      let inventory = this.fleet;
      let hubName = "All Active Airport Hubs (SFO, SEA, AUS)";

      if (hubFilter) {
        inventory = this.fleet.filter(v => v.hub.toUpperCase().includes(hubFilter));
        if (hubFilter === "SFO") hubName = "San Francisco International (SFO)";
        else if (hubFilter === "SEA") hubName = "Seattle-Tacoma International (SEA)";
        else if (hubFilter === "AUS") hubName = "Austin-Bergstrom International (AUS)";
        else hubName = `${hubFilter} Regional Hub`;
      }

      return {
        hub: hubName,
        requested_hub: hubFilter || "ALL",
        active_vehicles: inventory.length,
        average_wait_minutes: 4,
        fleet_inventory: inventory
      };
    }
  };

  static renderReservations() {
    const list = document.querySelector("#dispatch-list");
    if (!list) return;

    list.innerHTML = CityGlideApp.vault.reservations.map(r => `
      <div class="dispatch-card">
        <div class="dispatch-header">
          <span class="badge badge-success">${escapeHtml(r.status)}</span>
          <span class="transfer-code">${escapeHtml(r.transfer_id)}</span>
        </div>
        <div class="dispatch-body">
          <div class="dispatch-row"><strong>Passenger:</strong> <span>${escapeHtml(r.passenger_name)}</span></div>
          <div class="dispatch-row"><strong>Vehicle:</strong> <span>${escapeHtml(r.vehicle_class)}</span></div>
          <div class="dispatch-row"><strong>Driver:</strong> <span>${escapeHtml(r.driver)}</span></div>
          <div class="dispatch-row"><strong>Pickup:</strong> <span>${escapeHtml(r.pickup_location)} @ ${escapeHtml(r.pickup_time)}</span></div>
          <div class="dispatch-row"><strong>Destination:</strong> <span>${escapeHtml(r.dropoff_location)}</span></div>
          <div class="dispatch-row"><strong>Fare:</strong> <span class="price-pill">$${Number(r.fare_usd || 0).toFixed(2)} USD (Direct Rate)</span></div>
        </div>
      </div>
    `).join("");
  }

  static init() {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("oaw_cityglide_reservations");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const r of parsed.reverse()) {
              if (!CityGlideApp.vault.reservations.some(x => x.transfer_id === r.transfer_id)) {
                CityGlideApp.vault.reservations.unshift(r);
              }
            }
          }
        }
      }
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("oaw_provider_events");
        ch.onmessage = (e) => {
          if (e.data?.type === "cityglide_transfer_scheduled" && e.data.reservation) {
            const r = e.data.reservation;
            if (!CityGlideApp.vault.reservations.some(x => x.transfer_id === r.transfer_id)) {
              CityGlideApp.vault.reservations.unshift(r);
              CityGlideApp.renderReservations();
            }
          }
        };
      }
    } catch (e) {}

    CityGlideApp.renderReservations();

    const quoteBtn = document.querySelector("#calc-quote-btn");
    const quoteResult = document.querySelector("#quote-result");
    if (quoteBtn && quoteResult) {
      quoteBtn.addEventListener("click", () => {
        const dest = document.querySelector("#quote-dest")?.value || "HarborView Hotel";
        const flight = document.querySelector("#quote-flight")?.value || "UA 482";
        const time = document.querySelector("#quote-time")?.value || "4:30 PM";

        const q = CityGlideApp.vault.quoteService({
          destination: dest,
          flight_number: flight,
          pickup_time: time
        });

        quoteResult.innerHTML = `
          <div class="quote-card animate-fade">
            <h4>Quote from ${escapeHtml(q.origin)} to ${escapeHtml(q.destination)}</h4>
            <p class="flight-buffer-note">⚡ Flight ${escapeHtml(q.flight_number)} Landing Buffer: Curbside pickup at <strong>${escapeHtml(q.calculated_pickup_time)}</strong> (${escapeHtml(String(q.estimated_transit_minutes))} mins estimated transit)</p>
            <div class="vehicle-options-grid">
              ${q.options.map(opt => `
                <div class="opt-card">
                  <h5>${escapeHtml(opt.vehicle_class)}</h5>
                  <div class="opt-price">$${Number(opt.fare_usd).toFixed(2)} <span>USD</span></div>
                  <p class="opt-models">${escapeHtml(opt.models)}</p>
                  <ul class="opt-perks">
                    ${opt.features.map(f => `<li>✓ ${escapeHtml(f)}</li>`).join("")}
                  </ul>
                  <button class="btn-sm btn-outline" onclick="CityGlideApp.bookManual('${escapeHtml(opt.vehicle_class)}', ${opt.fare_usd})">Book This Class</button>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      });
    }
  }

  static bookManual(vehicleClass, fare) {
    CityGlideApp.vault.scheduleTransfer({
      passenger_name: "Walk-in Guest",
      vehicle_class: vehicleClass,
      pickup_location: "SFO Terminal 2 Curbside",
      dropoff_location: "HarborView Hotel, 450 Waterfront Blvd",
      pickup_time: "5:00 PM",
      fare_usd: fare
    });
    alert(`Transfer Reserved: ${vehicleClass} booked at $${fare}.00 USD!`);
  }
}

if (typeof window !== "undefined") {
  window.CityGlideApp = CityGlideApp;
}
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    CityGlideApp.init();
  });
}
