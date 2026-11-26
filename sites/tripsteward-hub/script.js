// TripSteward — Autonomous Federated Travel Concierge
// Operates 100% in browser memory. Dynamically discovers, mounts, and coordinates multi-agent web networks.

function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class TripStewardVault {
  constructor() {
    // Dynamic Active Journey Canvas (Zero hardcoded past trip history)
    this.activeJourney = {
      id: "journey-active",
      code: "TRIP #TS-7492",
      title: "Boutique Coastal Getaway & Sunset Sailing",
      traveler: { name: "Elena Rostova", party_size: 2, status: "Active Traveler" },
      destination: "San Francisco, CA",
      dates: "Nov 27 – Nov 29, 2026 (2 Nights)",
      flight_details: "United Airlines UA 482 • SFO Arrival: Friday 4:30 PM",
      target_budget_usd: 600,
      preferences: [
        { category: "Lodging Style", value: "Boutique waterfront hotel, quiet room, late check-in" },
        { category: "Ground Transfer", value: "Executive airport pickup synced with flight arrival buffer" },
        { category: "Activities", value: "Scenic sunset catamaran sailing on the bay for 2 guests" }
      ],
      room_options: [
        { tier: "Deluxe Bay-View Queen", rate: 189, status: "AVAILABLE", view: "Panoramic Bay & Bridge View" },
        { tier: "Urban Executive Loft", rate: 220, status: "AVAILABLE", view: "Skyline & City Lights" },
        { tier: "Panoramic Harbor Penthouse", rate: 395, status: "AVAILABLE", view: "Private Wrap-Around Terrace" }
      ],
      demo_script: {
        prompt: "TripSteward Concierge, please coordinate my journey for San Francisco. Reserve a quiet room at HarborView under $200/night, coordinate a private airport transfer with CityGlide for my flight arriving at 4:30 PM, and book two sunset bay cruise tickets with MetroPass.",
        cityglide_response: "CityGlide Transfer Dispatch confirmed: Vehicle 'Executive EV Sedan' (Tesla Model S) assigned. Flight UA 482 tracked in real-time. Pickup locked for 5:00 PM at SFO Terminal 2 with 30-minute post-touchdown grace buffer. Direct transit time to HarborView: 28 mins. Fixed Fare: $68.00 USD (Ref: #CG-TRANS-8492).",
        metropass_response: "MetroPass Experiences Curator confirmed: Reserved 2x VIP Tickets for 'Golden Gate Sunset Catamaran Sailing' on Saturday, Nov 28 at 5:45 PM. Priority boarding at Pier 39 included. Total Price: $158.00 USD (Ref: #MP-PASS-3104).",
        itinerary: {
          trip_title: "San Francisco Autumn Waterfront Retreat",
          destination: "San Francisco, California",
          dates: "Nov 27 – Nov 29, 2026 (2 Nights)",
          total_cost_usd: 604.00,
          direct_savings_usd: 161.00,
          itinerary_highlights: [
            "🏨 HarborView Hotel: Deluxe Bay-View Queen (2 Nights @ $189/night = $378)",
            "🚗 CityGlide Transfer: Executive EV Sedan (SFO Terminal 2 to Hotel = $68)",
            "⛵ MetroPass Experience: 2x Sunset Catamaran Sailing Passes ($158)"
          ],
          concierge_notes: "Direct booking confirmed across all connected provider nodes. 0% middleman booking fees. Digital passes and driver dispatch contact stored in your local session."
        }
      }
    };

    // Connected Agent Swarm (Active Federated Nodes)
    this.registeredAgents = [
      {
        id: "cityglide",
        name: "CityGlide Autonomous Fleet",
        role: "Ground Mobility & Flight Telemetry Dispatcher",
        front_man: "transfer_dispatcher",
        url: "https://pnrs.is-a.dev/rides/cityglide_transfer",
        tools: ["quote_transfer_service", "schedule_airport_transfer", "get_fleet_status"],
        category: "Mobility",
        status: "CONNECTED",
        icon: "🚗"
      },
      {
        id: "metropass",
        name: "MetroPass Experiences",
        role: "Tours, Museum Passes & Catamaran Cruises",
        front_man: "experience_curator",
        url: "https://pnrs.is-a.dev/experiences/metropass_experiences",
        tools: ["search_experiences", "book_experience_pass", "get_available_catalog"],
        category: "Activities",
        status: "CONNECTED",
        icon: "⛵"
      }
    ];

    // Open Agentic Web Discovery Directory (Catalog of discoverable nodes)
    this.catalogAgents = [
      {
        id: "tablebespoke",
        name: "TableBespoke Dining Network",
        role: "Michelin & Chef Table Reservations",
        front_man: "dining_sommelier",
        url: "https://pnrs.is-a.dev/dining/tablebespoke_concierge",
        tools: ["reserve_dining_table", "check_table_availability"],
        category: "Dining",
        description: "Priority table bookings at top-rated local culinary establishments with dietary pairing.",
        icon: "🍽️"
      },
      {
        id: "alpinetrail",
        name: "AlpineTrail Guided Expeditions",
        role: "Mountain, Ski & Wilderness Guide",
        front_man: "alpine_guide",
        url: "https://pnrs.is-a.dev/alpine/alpinetrail_guide",
        tools: ["book_expedition_pass", "check_trail_conditions"],
        category: "Adventures",
        description: "Certified wilderness guides, backcountry ski passes, and equipment reservations.",
        icon: "🎿"
      },
      {
        id: "luggagefly",
        name: "LuggageFly Logistics",
        role: "Curbside-to-Hotel Baggage Courier",
        front_man: "courier_dispatcher",
        url: "https://pnrs.is-a.dev/luggage/luggagefly_courier",
        tools: ["schedule_baggage_transfer", "track_luggage"],
        category: "Logistics",
        description: "Direct airport luggage pickup delivered straight to your hotel room before check-in.",
        icon: "🧳"
      },
      {
        id: "travelshield",
        name: "TravelShield Protection",
        role: "Autonomous Delay & Interruption Underwriter",
        front_man: "insurance_underwriter",
        url: "https://pnrs.is-a.dev/insurance/travelshield_underwriter",
        tools: ["quote_travel_policy", "file_instant_claim"],
        category: "Insurance",
        description: "Zero-paperwork parametric flight delay insurance with instant direct payout on 45+ min delay.",
        icon: "🛡️"
      }
    ];

    this.hotelReservation = null;
    this.airportTransfer = null;
    this.cityExperience = null;
    this.extraBookings = [];
    this.masterItinerary = null;
    this.simulating = false;
  }

  getActiveTrip() {
    const t = this.activeJourney;
    return {
      trip_id: t.code,
      title: t.title,
      traveler: t.traveler,
      destination: t.destination,
      dates: t.dates,
      flight_details: t.flight_details,
      target_budget_usd: t.target_budget_usd,
      preferences: t.preferences,
      room_options: t.room_options,
      confirmed_hotel: this.hotelReservation,
      confirmed_transfer: this.airportTransfer,
      confirmed_experience: this.cityExperience,
      extra_bookings: this.extraBookings,
      registered_agents: this.registeredAgents
    };
  }

  setJourney(data) {
    this.activeJourney.destination = data.destination || this.activeJourney.destination;
    this.activeJourney.dates = data.dates || this.activeJourney.dates;
    this.activeJourney.flight_details = data.flight_details || this.activeJourney.flight_details;
    this.activeJourney.target_budget_usd = data.target_budget_usd || this.activeJourney.target_budget_usd;
    this.activeJourney.title = `Journey to ${this.activeJourney.destination}`;
    if (data.notes) {
      this.activeJourney.preferences = [
        { category: "Traveler Request", value: data.notes },
        { category: "Flight Telemetry", value: this.activeJourney.flight_details }
      ];
    }
    this.hotelReservation = null;
    this.airportTransfer = null;
    this.cityExperience = null;
    this.extraBookings = [];
    this.masterItinerary = null;
    TripStewardApp.render();
  }

  // Dynamic Agent Registry Methods
  searchAgents(args = {}) {
    const query = args.query ? args.query.toLowerCase() : "";
    const category = args.category ? args.category.toLowerCase() : "";

    const results = this.catalogAgents.filter(agent => {
      const matchCat = !category || category === "all" || agent.category.toLowerCase() === category;
      const matchQuery = !query || agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.tools.some(t => t.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });

    return {
      ok: true,
      count: results.length,
      total_found: results.length,
      results: results,
      agents: results,
      protocol: "nsdeploy-link/v1",
      note: "Discovered via Open Agentic Web Directory."
    };
  }

  addAgentOnTheFly(agentData = {}) {
    // Check if in catalog or custom
    let agent = this.catalogAgents.find(a => a.id === agentData.id || a.url === agentData.node_url);

    if (!agent) {
      // Create custom node entry
      const cleanName = (agentData.name || "custom-agent").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const customId = `custom-${cleanName}`;
      agent = {
        id: customId,
        name: agentData.name || "Custom Agentic Web Node",
        role: agentData.role || `${agentData.category || 'Specialist'} Service Agent`,
        front_man: agentData.front_man || "service_specialist",
        url: agentData.node_url,
        tools: agentData.tools || ["query_service", "book_direct"],
        category: agentData.category || "Custom Service",
        description: `External agentic node dynamically linked from ${agentData.node_url}`,
        status: "CONNECTED",
        icon: "🔌"
      };
    } else {
      agent.status = "CONNECTED";
    }

    if (!this.registeredAgents.some(a => a.id === agent.id)) {
      this.registeredAgents.push(agent);
    }

    if (typeof TripStewardApp !== "undefined" && typeof TripStewardApp.renderSwarm === "function") {
      TripStewardApp.renderSwarm();
      TripStewardApp.appendSimulatedMessage("bot", `🔌 **Orchestrator Link:** Successfully mounted new agent **${agent.name}** (${agent.url}) on the fly. Declared machine tools: \`${agent.tools.join("`, `")}\`.`);
    }

    return {
      ok: true,
      success: true,
      agent: agent,
      agent_id: agent.id,
      name: agent.name,
      tools_registered: agent.tools,
      total_registered_agents: this.registeredAgents.length,
      message: `Node '${agent.name}' mounted to orchestrator graph.`
    };
  }

  unlinkAgent(agentId) {
    this.registeredAgents = this.registeredAgents.filter(a => a.id !== agentId);
    if (typeof TripStewardApp !== "undefined" && typeof TripStewardApp.renderSwarm === "function") {
      TripStewardApp.renderSwarm();
      TripStewardApp.appendSimulatedMessage("bot", `Unlinked agent node \`${agentId}\` from active swarm.`);
    }
  }

  reserveHotelRoom(room) {
    this.hotelReservation = {
      id: "HV-STAY-" + Math.floor(10000 + Math.random() * 90000),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "RESERVED_DIRECT",
      ...room
    };
    TripStewardApp.renderBookings();
    return {
      ok: true,
      reservation_id: this.hotelReservation.id,
      total_stay_cost: room.nightly_rate_usd * room.nights,
      message: `HarborView room '${room.room_tier}' successfully reserved for ${room.nights} nights.`
    };
  }

  bookAirportTransfer(transfer) {
    this.airportTransfer = {
      id: "CG-TRANS-" + Math.floor(10000 + Math.random() * 90000),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "DISPATCHED_ON_NETWORK",
      ...transfer
    };
    TripStewardApp.renderBookings();
    return {
      ok: true,
      transfer_booking_id: this.airportTransfer.id,
      fare_usd: transfer.fare_usd,
      message: `CityGlide ${transfer.vehicle_class} transfer scheduled for ${transfer.pickup_time}.`
    };
  }

  bookCityExperience(exp) {
    this.cityExperience = {
      id: "MP-PASS-" + Math.floor(10000 + Math.random() * 90000),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "CONFIRMED_VOUCHER_ISSUED",
      ...exp
    };
    TripStewardApp.renderBookings();
    return {
      ok: true,
      experience_pass_id: this.cityExperience.id,
      total_price_usd: exp.total_price_usd,
      message: `MetroPass confirmed ${exp.tickets_count}x tickets for '${exp.experience_name}'.`
    };
  }

  compileMasterItinerary(itinerary) {
    this.masterItinerary = {
      generated_at: new Date().toISOString(),
      trip_code: this.activeJourney.code,
      ...itinerary
    };
    TripStewardApp.renderItinerary();
    return {
      ok: true,
      status: "COMMITTED_TO_CLIENT_SESSION",
      itinerary_id: "TS-ITIN-" + Math.floor(100000 + Math.random() * 900000),
      message: "Unified Master Travel Itinerary synthesized and sealed with direct provider savings."
    };
  }

  runDemoSimulation() {
    if (this.simulating) return;
    this.simulating = true;
    const t = this.activeJourney;
    const demo = t.demo_script;

    const btn = document.querySelector("#demo-simulate-btn");
    if (btn) btn.innerHTML = `<span>⏳ Playing Offline Demo Flow...</span>`;

    TripStewardApp.appendSimulatedMessage("bot", `ℹ️ **Offline Demo Mode:** Previewing multi-agent federation flow with simulated responses. To run live LLM inference with your own key, configure your BYOK key in the chat settings below.`);
    TripStewardApp.appendSimulatedMessage("user", demo.prompt);

    // 1. Hotel Reservation
    setTimeout(() => {
      TripStewardApp.appendSimulatedMessage("bot", `🛎️ **Travel Orchestrator:** Starting dynamic Open Agentic Web coordination for ${escapeHtml(t.destination)}. Direct-holding HarborView boutique room...`);
      
      this.reserveHotelRoom({
        room_tier: t.room_options[0].tier,
        nightly_rate_usd: t.room_options[0].rate,
        nights: 2,
        guest_names: t.traveler.name,
        amenities_included: ["Waterfront View", "High-Speed Wi-Fi", "Late Check-out 1 PM", "Artisan Coffee Bar"]
      });
    }, 600);

    // 2. CityGlide Flight Telemetry Transfer
    setTimeout(() => {
      const origin = (typeof window !== "undefined" && window.location) ? window.location.origin : "https://pnrs.is-a.dev";
      TripStewardApp.appendSimulatedMessage("transfer", `🚗 **CityGlide Mobility Node (${origin}/rides):** ${demo.cityglide_response}`);
      
      this.bookAirportTransfer({
        pickup_location: t.flight_details,
        dropoff_location: "HarborView Hotel, 450 Waterfront Blvd",
        vehicle_class: "Executive EV Sedan (Lucid Air / Tesla Model S)",
        pickup_time: "5:00 PM (Flight UA 482 landing buffer +30m)",
        fare_usd: 68.00
      });
    }, 1800);

    // 3. MetroPass Experiences Ticketing
    setTimeout(() => {
      const origin = (typeof window !== "undefined" && window.location) ? window.location.origin : "https://pnrs.is-a.dev";
      TripStewardApp.appendSimulatedMessage("experiences", `⛵ **MetroPass Experiences (${origin}/experiences):** ${demo.metropass_response}`);
      
      this.bookCityExperience({
        experience_name: "Golden Gate Sunset Catamaran Cruise",
        scheduled_slot: "Saturday, 5:45 PM – 7:30 PM",
        tickets_count: t.traveler.party_size,
        total_price_usd: 158.00,
        special_notes: "Arrive at Pier 39 gate B 15 minutes prior. Digital QR pass verified."
      });
    }, 3000);

    // 4. Any Dynamic Extra Agents Connected
    const hasDining = this.registeredAgents.some(a => a.id === "tablebespoke");
    const hasShield = this.registeredAgents.some(a => a.id === "travelshield");

    if (hasDining) {
      setTimeout(() => {
        TripStewardApp.appendSimulatedMessage("bot", `🍽️ **TableBespoke Dining Node:** Priority Chef Table reserved at *Atelier Crenn* (Waterfront) for Saturday at 8:30 PM. Reference: #DINE-8821.`);
      }, 3600);
    }

    if (hasShield) {
      setTimeout(() => {
        TripStewardApp.appendSimulatedMessage("bot", `🛡️ **TravelShield Underwriter:** Instant parametric flight delay policy bound for flight UA 482. Instant $150 credit on 45m delay. Policy #TS-INS-4402.`);
      }, 3900);
    }

    // 5. Master Pass Synthesis
    setTimeout(() => {
      TripStewardApp.appendSimulatedMessage("bot", `🛎️ **Travel Orchestrator:** All direct reservations confirmed across ${this.registeredAgents.length + 1} independent websites! 0% aggregator markups applied. Synthesizing sealed Master Travel Pass...`);
      this.compileMasterItinerary(demo.itinerary);
      this.simulating = false;
      if (btn) btn.innerHTML = `<span>✓ Demo Flow Completed</span>`;
    }, 4500);
  }
}

export class TripStewardApp {
  static vault = new TripStewardVault();

  static init() {
    TripStewardApp.bindEvents();
    TripStewardApp.renderSwarm();
    TripStewardApp.render();
  }

  static bindEvents() {
    // Journey Capsule click opens edit journey modal
    const capsule = document.querySelector("#capsule-clickable");
    const journeyModal = document.querySelector("#edit-journey-modal");
    const editJourneyBtn = document.querySelector("#edit-journey-btn");
    const closeJourneyBtn = document.querySelector("#close-journey-modal-btn");
    const cancelJourneyBtn = document.querySelector("#cancel-journey-btn");
    const journeyForm = document.querySelector("#edit-journey-form");

    if (capsule && journeyModal) {
      capsule.addEventListener("click", () => journeyModal.showModal());
    }
    if (editJourneyBtn && journeyModal) {
      editJourneyBtn.addEventListener("click", () => journeyModal.showModal());
    }
    if (closeJourneyBtn && journeyModal) {
      closeJourneyBtn.addEventListener("click", () => journeyModal.close());
    }
    if (cancelJourneyBtn && journeyModal) {
      cancelJourneyBtn.addEventListener("click", () => journeyModal.close());
    }
    if (journeyForm && journeyModal) {
      journeyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const dest = document.querySelector("#edit-dest")?.value || "San Francisco, CA";
        const dates = document.querySelector("#edit-dates")?.value || "Upcoming Weekend";
        const flight = document.querySelector("#edit-flight")?.value || "Flight SFO-101";
        const budget = parseFloat(document.querySelector("#edit-budget")?.value) || 600;
        const notes = document.querySelector("#edit-notes")?.value || "";

        TripStewardApp.vault.setJourney({
          destination: dest,
          dates: dates,
          flight_details: flight,
          target_budget_usd: budget,
          notes: notes
        });

        journeyModal.close();
      });
    }

    // Agent Discovery Modal Handlers
    const discoverModal = document.querySelector("#discover-agents-modal");
    const openDiscoverBtn = document.querySelector("#open-discover-agents-btn");
    const quickAddBtn = document.querySelector("#quick-add-agent-btn");
    const closeDiscoverBtn = document.querySelector("#close-discover-modal-btn");
    const searchInput = document.querySelector("#agent-search-input");
    const catFilter = document.querySelector("#agent-category-filter");

    const openDiscover = () => {
      TripStewardApp.renderDiscoverResults();
      discoverModal.showModal();
    };

    if (openDiscoverBtn && discoverModal) openDiscoverBtn.addEventListener("click", openDiscover);
    if (quickAddBtn && discoverModal) quickAddBtn.addEventListener("click", openDiscover);
    if (closeDiscoverBtn && discoverModal) closeDiscoverBtn.addEventListener("click", () => discoverModal.close());

    if (searchInput) {
      searchInput.addEventListener("input", () => TripStewardApp.renderDiscoverResults());
    }
    if (catFilter) {
      catFilter.addEventListener("change", () => TripStewardApp.renderDiscoverResults());
    }

    // Custom Agent Modal Handlers
    const customAgentModal = document.querySelector("#custom-agent-modal");
    const openCustomAgentBtn = document.querySelector("#open-custom-agent-btn");
    const closeCustomAgentBtn = document.querySelector("#close-custom-agent-modal-btn");
    const cancelCustomAgentBtn = document.querySelector("#cancel-custom-agent-btn");
    const customAgentForm = document.querySelector("#custom-agent-form");

    if (openCustomAgentBtn && customAgentModal) {
      openCustomAgentBtn.addEventListener("click", () => customAgentModal.showModal());
    }
    if (closeCustomAgentBtn && customAgentModal) {
      closeCustomAgentBtn.addEventListener("click", () => customAgentModal.close());
    }
    if (cancelCustomAgentBtn && customAgentModal) {
      cancelCustomAgentBtn.addEventListener("click", () => customAgentModal.close());
    }
    if (customAgentForm && customAgentModal) {
      customAgentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const url = document.querySelector("#node-custom-url")?.value.trim();
        const name = document.querySelector("#node-custom-name")?.value.trim();
        const front = document.querySelector("#node-custom-front")?.value.trim();
        const cat = document.querySelector("#node-custom-cat")?.value.trim();

        if (url) {
          TripStewardApp.vault.addAgentOnTheFly({
            node_url: url,
            name: name,
            front_man: front,
            category: cat
          });
        }
        customAgentModal.close();
      });
    }

    // Orchestration Actions
    const demoSimBtn = document.querySelector("#demo-simulate-btn");
    if (demoSimBtn) {
      demoSimBtn.addEventListener("click", () => {
        TripStewardApp.vault.runDemoSimulation();
      });
    }

    const hotelBtn = document.querySelector("#book-hotel-manual-btn");
    if (hotelBtn) hotelBtn.addEventListener("click", () => TripStewardApp.quickHoldHotel());

    const transferBtn = document.querySelector("#book-transfer-manual-btn");
    if (transferBtn) transferBtn.addEventListener("click", () => TripStewardApp.quickBookTransfer());

    const expBtn = document.querySelector("#book-exp-manual-btn");
    if (expBtn) expBtn.addEventListener("click", () => TripStewardApp.quickBookExperience());

    const prefillBtn = document.querySelector("#demo-prefill-btn");
    if (prefillBtn) {
      prefillBtn.addEventListener("click", () => {
        const t = TripStewardApp.vault.activeJourney;
        const input = document.querySelector("#ns-query-input") || document.querySelector("input[type='text'].ns-input");
        if (input) {
          input.value = t.demo_script.prompt;
          input.focus();
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(t.demo_script.prompt);
          alert("Copied sample prompt to clipboard! Paste it into the orchestrator chat below.");
        }
      });
    }

    const resetBtn = document.querySelector("#demo-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        TripStewardApp.vault.setJourney({});
        const simBtn = document.querySelector("#demo-simulate-btn");
        if (simBtn) simBtn.innerHTML = `<span class="btn-icon">▶</span><span>Preview Demo Flow (No Key)</span>`;
        const chatMsgs = document.querySelector("#ns-msgs");
        if (chatMsgs) {
          chatMsgs.innerHTML = `<div class="ns-msg bot">I am your autonomous Travel Orchestrator. I discover and coordinate independent specialist agents across the Open Agentic Web on your behalf. How can I assist with your journey?</div>`;
        }
      });
    }

    const exportBtn = document.querySelector("#export-itinerary-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (!TripStewardApp.vault.masterItinerary) {
          TripStewardApp.vault.compileMasterItinerary({
            trip_title: TripStewardApp.vault.activeJourney.title,
            destination: TripStewardApp.vault.activeJourney.destination,
            dates: TripStewardApp.vault.activeJourney.dates,
            total_cost_usd: 604.00,
            direct_savings_usd: 161.00,
            itinerary_highlights: [
              "HarborView Hotel Room Direct Reservation",
              "CityGlide Executive EV Airport Chauffeur (Flight-Synced)",
              "MetroPass Verified City Experience Passes"
            ],
            concierge_notes: "Direct booking verified across Open Agentic Web nodes. Instant digital passes saved."
          });
        }
        TripStewardApp.downloadItineraryText();
      });
    }
  }

  static renderSwarm() {
    const container = document.querySelector("#active-agents-list");
    const countPill = document.querySelector("#swarm-count-pill");
    const agents = TripStewardApp.vault.registeredAgents;

    if (countPill) {
      countPill.textContent = `${agents.length} External Nodes Connected`;
    }

    if (!container) return;

    container.innerHTML = agents.map(agent => `
      <div class="swarm-node-chip">
        <span class="chip-icon">${escapeHtml(agent.icon || '🌐')}</span>
        <div class="chip-info">
          <span class="chip-name">${escapeHtml(agent.name)}</span>
          <span class="chip-role">${escapeHtml(agent.category)} • ${escapeHtml(agent.front_man)}</span>
        </div>
        <span class="chip-status-dot" title="Active on Open Agentic Web"></span>
        <button class="chip-unlink-btn" onclick="TripStewardApp.unlinkAgentNode('${escapeHtml(agent.id)}')" title="Unlink agent from swarm">&times;</button>
      </div>
    `).join("");
  }

  static renderDiscoverResults() {
    const resultsBox = document.querySelector("#discover-agents-results");
    if (!resultsBox) return;

    const query = document.querySelector("#agent-search-input")?.value || "";
    const cat = document.querySelector("#agent-category-filter")?.value || "all";

    const { agents } = TripStewardApp.vault.searchAgents({ query, category: cat });
    const registeredIds = TripStewardApp.vault.registeredAgents.map(a => a.id);

    if (agents.length === 0) {
      resultsBox.innerHTML = `<div class="empty-results">No agent nodes found matching your query. You can add any custom node using the "Add Agent URL" tool.</div>`;
      return;
    }

    resultsBox.innerHTML = agents.map(agent => {
      const isLinked = registeredIds.includes(agent.id);
      return `
        <div class="discover-agent-card ${isLinked ? 'already-linked' : ''}">
          <div class="discover-card-top">
            <span class="discover-icon">${escapeHtml(agent.icon)}</span>
            <span class="badge-cat">${escapeHtml(agent.category)}</span>
          </div>
          <h4>${escapeHtml(agent.name)}</h4>
          <p class="discover-desc">${escapeHtml(agent.description)}</p>
          <div class="discover-tools-list">
            Tools: <code>${agent.tools.map(t => escapeHtml(t)).join("</code>, <code>")}</code>
          </div>
          <div class="discover-card-action">
            ${isLinked 
              ? `<span class="linked-indicator">✓ Connected to Swarm</span>` 
              : `<button class="btn-mount-agent" onclick="TripStewardApp.linkCatalogAgent('${escapeHtml(agent.id)}')">+ Mount to Orchestrator</button>`
            }
          </div>
        </div>
      `;
    }).join("");
  }

  static linkCatalogAgent(agentId) {
    const agent = TripStewardApp.vault.catalogAgents.find(a => a.id === agentId);
    if (agent) {
      TripStewardApp.vault.addAgentOnTheFly(agent);
      TripStewardApp.renderDiscoverResults();
    }
  }

  static unlinkAgentNode(agentId) {
    TripStewardApp.vault.unlinkAgent(agentId);
  }

  static quickHoldHotel() {
    const t = TripStewardApp.vault.activeJourney;
    const room = t.room_options[0];
    TripStewardApp.vault.reserveHotelRoom({
      room_tier: room.tier,
      nightly_rate_usd: room.rate,
      nights: 2,
      guest_names: t.traveler.name,
      amenities_included: ["Artisan Breakfast", "High-Speed Wi-Fi", "Late Check-out 1 PM"]
    });
  }

  static quickBookTransfer() {
    const t = TripStewardApp.vault.activeJourney;
    TripStewardApp.vault.bookAirportTransfer({
      pickup_location: t.flight_details,
      dropoff_location: "HarborView Hotel, 450 Waterfront Blvd",
      vehicle_class: "Executive EV Sedan (Tesla Model S)",
      pickup_time: "5:00 PM (Flight buffer +30m)",
      fare_usd: 45.00
    });
  }

  static quickBookExperience() {
    const t = TripStewardApp.vault.activeJourney;
    TripStewardApp.vault.bookCityExperience({
      experience_name: "Golden Gate Sunset Catamaran Cruise",
      scheduled_slot: "Saturday, 5:45 PM – 7:30 PM",
      tickets_count: t.traveler.party_size,
      total_price_usd: 100.00,
      special_notes: "Boarding at Pier 39, Marina Gate B"
    });
  }

  static selectRoomTier(tier, rate) {
    const cards = document.querySelectorAll(".room-option-card");
    cards.forEach(c => {
      if (c.getAttribute("data-tier") === tier) {
        c.classList.add("selected");
      } else {
        c.classList.remove("selected");
      }
    });
    const priceAmount = document.querySelector(".price-amount");
    if (priceAmount) priceAmount.textContent = `$${rate}`;
  }

  static appendSimulatedMessage(role, text) {
    const chatMsgs = document.querySelector("#ns-msgs");
    if (!chatMsgs) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `ns-msg ${role} sim-msg-${role}`;
    msgDiv.innerHTML = text.replace(/\n/g, "<br>");
    chatMsgs.appendChild(msgDiv);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  static render() {
    const t = TripStewardApp.vault.activeJourney;
    if (!t) return;

    const tripTitle = document.querySelector("#active-trip-title");
    const tripDestination = document.querySelector("#active-trip-destination");
    const tripTraveler = document.querySelector("#active-trip-traveler");

    if (tripTitle) tripTitle.textContent = t.title;
    if (tripDestination) {
      tripDestination.textContent = `Destination: ${t.destination} • Dates: ${t.dates} • ${t.flight_details}`;
    }
    if (tripTraveler) {
      tripTraveler.textContent = `Traveler: ${t.traveler.name} (${t.traveler.party_size} Guests) • Budget: $${t.target_budget_usd} USD`;
    }

    const capDest = document.querySelector("#capsule-dest");
    const capDates = document.querySelector("#capsule-dates");
    const capFlight = document.querySelector("#capsule-flight");
    const capTravelers = document.querySelector("#capsule-travelers");

    if (capDest) capDest.textContent = t.destination;
    if (capDates) capDates.textContent = t.dates;
    if (capFlight) capFlight.textContent = t.flight_details.split("•")[0]?.trim() || t.flight_details;
    if (capTravelers) capTravelers.textContent = `${t.traveler.party_size} Guests • <$${Math.round(t.target_budget_usd / 2)}/nt`;

    const passCity = document.querySelector("#pass-city");
    const passDates = document.querySelector("#pass-dates");
    if (passCity) passCity.textContent = t.destination.split(",")[0];
    if (passDates) passDates.textContent = t.dates;

    const roomContainer = document.querySelector("#room-inventory-list");
    if (roomContainer) {
      roomContainer.innerHTML = t.room_options.map((r, idx) => `
        <div class="room-option-card ${idx === 0 ? 'selected' : ''}" data-tier="${r.tier}" onclick="TripStewardApp.selectRoomTier('${r.tier}', ${r.rate})">
          <div class="room-tier-title">${r.tier}</div>
          <div class="room-view-desc">${r.view}</div>
          <div class="room-rate-tag">$${r.rate} <span style="font-size: 0.75rem; color: #64748b; font-weight: normal;">/ night</span></div>
        </div>
      `).join("");
    }

    TripStewardApp.renderBookings();
    TripStewardApp.renderItinerary();
  }

  static renderBookings() {
    const hotel = TripStewardApp.vault.hotelReservation;
    const transfer = TripStewardApp.vault.airportTransfer;
    const exp = TripStewardApp.vault.cityExperience;

    const hotelTag = document.querySelector("#hotel-status-tag");
    const hotelBtn = document.querySelector("#book-hotel-manual-btn");
    if (hotelTag) {
      if (hotel) {
        hotelTag.className = "status-pill status-confirmed";
        hotelTag.textContent = `✓ Reserved (#${hotel.id})`;
        if (hotelBtn) hotelBtn.textContent = "✓ Room Held in Session";
      } else {
        hotelTag.className = "status-pill status-ready";
        hotelTag.textContent = "Ready for Concierge Hold";
        if (hotelBtn) hotelBtn.textContent = "Hold Room Directly ($185/nt)";
      }
    }

    const transferTag = document.querySelector("#transfer-status-tag");
    const transferBtn = document.querySelector("#book-transfer-manual-btn");
    if (transferTag) {
      if (transfer) {
        transferTag.className = "status-pill status-confirmed";
        transferTag.textContent = `✓ Dispatched (#${transfer.id})`;
        if (transferBtn) transferBtn.textContent = "✓ Chauffeur Dispatched";
      } else {
        transferTag.className = "status-pill status-ready";
        transferTag.textContent = "Flight Telemetry Synced";
        if (transferBtn) transferBtn.textContent = "Dispatch Airport Chauffeur ($45)";
      }
    }

    const expTag = document.querySelector("#exp-status-tag");
    const expBtn = document.querySelector("#book-exp-manual-btn");
    if (expTag) {
      if (exp) {
        expTag.className = "status-pill status-confirmed";
        expTag.textContent = `✓ 2x Passes Issued (#${exp.id})`;
        if (expBtn) expBtn.textContent = "✓ Digital Passes Issued";
      } else {
        expTag.className = "status-pill status-ready";
        expTag.textContent = "Direct Partner Passes";
        if (expBtn) expBtn.textContent = "Issue 2x Passes ($100.00)";
      }
    }

    const hotelCost = hotel ? (hotel.nightly_rate_usd * hotel.nights) : 370;
    const transferCost = transfer ? transfer.fare_usd : 45;
    const expCost = exp ? exp.total_price_usd : 100;
    const totalCost = hotelCost + transferCost + expCost;
    const otaCost = Math.round(totalCost * 1.275);

    const rHotel = document.querySelector("#receipt-hotel");
    const rTransfer = document.querySelector("#receipt-transfer");
    const rExp = document.querySelector("#receipt-exp");
    const rTotal = document.querySelector("#receipt-total");
    const rOta = document.querySelector("#receipt-ota");

    if (rHotel) rHotel.textContent = `$${hotelCost.toFixed(2)}`;
    if (rTransfer) rTransfer.textContent = `$${transferCost.toFixed(2)}`;
    if (rExp) rExp.textContent = `$${expCost.toFixed(2)}`;
    if (rTotal) rTotal.textContent = `$${totalCost.toFixed(2)}`;
    if (rOta) rOta.textContent = `$${otaCost.toFixed(2)}`;

    const count = (hotel ? 1 : 0) + (transfer ? 1 : 0) + (exp ? 1 : 0);
    const countBadge = document.querySelector("#bookings-count-badge");
    if (countBadge) {
      countBadge.textContent = count > 0 ? `${count} Direct Bookings Confirmed` : "3 Direct Providers Linked";
    }

    const container = document.querySelector("#confirmed-bookings-container");
    if (container) {
      if (count === 0) {
        container.innerHTML = `<div class="empty-state">No direct provider reservations committed yet.</div>`;
      } else {
        container.innerHTML = `
          ${hotel ? `<div>🏨 Hotel: ${hotel.room_tier} (#${hotel.id})</div>` : ''}
          ${transfer ? `<div>🚗 Ride: ${transfer.vehicle_class} (#${transfer.id})</div>` : ''}
          ${exp ? `<div>⛵ Exp: ${exp.experience_name} (#${exp.id})</div>` : ''}
        `;
      }
    }
  }

  static renderItinerary() {
    const d = TripStewardApp.vault.masterItinerary;
    const codeLabel = document.querySelector("#pass-code-label");
    if (codeLabel && d) {
      codeLabel.textContent = d.itinerary_id || "TS-PASS-7492";
    }

    const container = document.querySelector("#itinerary-output");
    if (container && d) {
      container.innerHTML = `
        <div class="itinerary-card">
          <h4>${d.trip_title}</h4>
          <div>Direct Total: $${d.total_cost_usd} USD</div>
          <div>Direct Savings: $${d.direct_savings_usd} USD</div>
        </div>
      `;
    }
  }

  static downloadItineraryText() {
    const d = TripStewardApp.vault.masterItinerary || {
      trip_code: "TS-PASS-7492",
      generated_at: new Date().toISOString(),
      total_cost_usd: 604.00,
      direct_savings_usd: 161.00,
      trip_title: "San Francisco Autumn Waterfront Retreat",
      destination: "San Francisco, CA",
      dates: "Nov 27 – Nov 29, 2026 (2 Nights)",
      itinerary_highlights: [
        "HarborView Hotel: Deluxe Bay-View Queen (2 Nights @ $189/night = $378)",
        "CityGlide Transfer: Executive EV Sedan from SFO ($68)",
        "MetroPass Experience: 2x Sunset Catamaran Sailing Passes ($158)"
      ],
      concierge_notes: "Direct provider rates confirmed. Instant digital mobile passes saved."
    };

    const content = `=====================================================
TRIPSTEWARD MASTER DIGITAL TRAVEL PASS
Pass Code: ${d.trip_code || "TS-PASS-7492"}
Generated: ${new Date(d.generated_at).toLocaleString()}
Direct Provider Total: $${d.total_cost_usd.toFixed(2)} USD
Direct Intermediary Savings: $${d.direct_savings_usd.toFixed(2)} USD
=====================================================

CURATED JOURNEY:
${d.trip_title} (${d.destination})
Dates: ${d.dates}

CONFIRMED DIRECT RESERVATIONS:
${d.itinerary_highlights.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

CONCIERGE ARRIVAL BRIEFING:
${d.concierge_notes}

=====================================================
FEDERATED OPEN AGENTIC WEB NODES:
• HarborView Hotel: https://pnrs.is-a.dev/tripsteward/
• CityGlide Transfer: https://pnrs.is-a.dev/rides/
• MetroPass Experiences: https://pnrs.is-a.dev/experiences/
Zero 3rd-Party Markups • 100% In-Browser Privacy
=====================================================`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TripSteward_Travel_Pass_${(d.trip_code || "TS_PASS").replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

if (typeof window !== "undefined") {
  window.TripStewardApp = TripStewardApp;
  document.addEventListener("DOMContentLoaded", () => {
    TripStewardApp.init();
  });
}
