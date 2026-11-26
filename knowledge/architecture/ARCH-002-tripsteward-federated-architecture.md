# ARCH-002: TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture

---
id: "ARCH-002"
type: "architecture"
title: "TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture"
domain: "architecture"
status: "APPROVED"
version: "1.2.0"
---

## Rule
TripSteward implements an autonomous, cross-site federated booking and travel orchestrator architecture adhering to the Open Agentic Web MVP Profile 0.3 specification:

1. **Top-Level Orchestrator Hub (`tripsteward-hub`)**:
   - Operates as the traveler's sovereign intake, trip canvas, and dynamic multi-agent orchestrator running 100% in-browser.
   - Hosts the `tripsteward_concierge` (Chief Travel Orchestrator Agent `travel_concierge`) coordinating boutique hotel holds, flight-synchronized airport chauffeur transfers, and city activity ticketing.
   - Dynamic On-the-Fly Agent Discovery & Mounting: Exposes `website_discover_agent_nodes` (searchable 4-specialist directory across dining, adventures, baggage logistics, insurance: TableBespoke, AlpineTrail, LuggageFly, TravelShield) and `website_register_agent_node` to mount arbitrary third-party Agentic Web nodes on the fly with async network manifest verification.
   - Resolves peer specialist networks dynamically via `links.json` (`cityglide` and `metropass`) with interactive human consent approval (`onConsent`).
   - Replaced static preloaded records with a dynamic Journey Canvas where travelers configure custom destinations, dates, flight tracking telemetry, room tiers, and budget goals.
   - Dynamic Provider Cards & Receipt Synchronization: Dynamically mounts connected external specialist nodes into `#dynamic-provider-cards-container` and adds confirmed direct bookings to `#receipt-extra-items` on the Master Travel Pass.
   - Synthesizes all confirmed bookings into a single, unified Master Digital Travel Pass with verified programmatic provider totals and direct savings.
2. **CityGlide Autonomous Fleet Node (`cityglide-node`)**:
   - Standalone static agentic website publishing `agent-manifest.json` and `cityglide_transfer.network.json`.
   - Specializes in real-time flight arrival telemetry, dynamic baggage buffer calculation (+30m domestic, +45m international), vehicle class recommendations (Executive EV Sedan: $68.00, Luxury Chauffeur SUV: $108.00), airport hub filtering (SFO, SEA, AUS), and direct ride dispatch.
   - Exposes CORS headers (`Access-Control-Allow-Origin: *`) and callable machine tools: `website_quote_transfer_service`, `website_schedule_airport_transfer`, `website_get_fleet_status`.
3. **MetroPass Experiences Node (`metropass-node`)**:
   - Standalone static agentic website publishing `agent-manifest.json` and `metropass_experiences.network.json`.
   - Specializes in curated city adventures (Sunset Catamaran Cruises, SFMOMA VIP Passes, Culinary Tours), dynamic catalog search filtering, honest zero-match handling without silent fallbacks, and real inline SVG QR digital pass generation.
   - Exposes CORS headers (`Access-Control-Allow-Origin: *`) and callable machine tools: `website_search_experiences`, `website_book_experience_pass`, `website_get_available_catalog`.
4. **Agent Action Invariant & Zero Middleman Fees**:
   - Agents act on behalf of the user to discover inventory, reserve rooms, dispatch vehicles, and issue tickets directly with providers.
   - Direct provider transactions eliminate 15-30% aggregator platform surcharges ($142+ saved per itinerary).
   - All booking tokens, passes, and personal itineraries reside strictly in browser memory (`localStorage` / RAM).

## Do
- Ground all agent decisions in machine-executable `agentTools` declared in `agent-manifest.json` and backed by JSON-schema validated `site-actions.js`.
- Provide interactive confirmation modals (`onActionConfirm`) for irreversible booking actions (`reserve_hotel_room`, `schedule_airport_transfer`, `book_experience_pass`).
- Maintain 100% in-browser client execution using Mozilla Otari BYOK inference (`alibaba/qwen3.8-flash`).
- Ensure all 3 static nodes serve with CORS enabled for cross-origin agent graph fetches.

## Dont
- Do NOT transmit traveler payment credentials or booking history to backend hosting servers.
- Do NOT hardcode API keys in published manifests or networks.
- Do NOT bypass explicit human consent before invoking remote peer agents or committing funds.

## Reason
Traditional online travel agencies (OTAs) act as walled-garden aggregators charging high commissions, hiding real provider availability, and forcing users into manual cross-site copy-pasting. TripSteward demonstrates how the Open Agentic Web empowers autonomous agents to discover and execute actions across disparate independent websites directly on the traveler's behalf.

## Related Items
- `knowledge/index.yaml`
- `PROD-001`: Open Agentic Web Challenge Specification & Submission Protocol
- `DEV-001`: In-Browser Runtime, Site Actions & Otari BYOK Standards
- `DEV-002`: Production VM Deployment & Reverse Proxy Architecture
