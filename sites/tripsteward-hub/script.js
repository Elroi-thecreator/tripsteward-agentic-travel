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

function showToast(message, type = "info") {
  if (typeof document === "undefined") return;
  let container = document.getElementById("oaw-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "oaw-toast-container";
    container.style.cssText = "position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; max-width: 380px;";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  const bg = type === "success" ? "#059669" : type === "error" ? "#dc2626" : "#0284c7";
  toast.style.cssText = `background: ${bg}; color: white; padding: 12px 18px; border-radius: 8px; font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: space-between; gap: 12px; transform: translateY(20px); opacity: 0; transition: all 0.25s ease;`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><button style="background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; font-size: 16px; padding: 0;">&times;</button>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });
  const remove = () => {
    toast.style.transform = "translateY(20px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector("button").onclick = remove;
  setTimeout(remove, 4500);
}

let _hvSigningKey = null;

async function getHarborViewSigningKey() {
  if (_hvSigningKey) return _hvSigningKey;
  // 1. If running in Node.js test environment, load securely from server keys file
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const keyFile = path.resolve(process.cwd(), "scripts", "provider_keys.json");
      if (fs.existsSync(keyFile)) {
        const keys = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
        if (keys["harborview-key-1"]) {
          _hvSigningKey = keys["harborview-key-1"];
          return _hvSigningKey;
        }
      }
    } catch {}
  }
  // 2. In browser RAM: generate non-extractable ephemeral session keypair (zero plaintext keys in code)
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const keyPair = await subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );
      const priv = await subtle.exportKey("jwk", keyPair.privateKey);
      const pub = await subtle.exportKey("jwk", keyPair.publicKey);
      priv.kid = `harborview-session-${Date.now().toString(36)}`;
      pub.kid = priv.kid;
      _hvSigningKey = { ...priv, publicKeyJwk: pub };
      return _hvSigningKey;
    }
  } catch {}
  return null;
}

function isAllowedPeerOrigin(origin) {
  if (!origin) return false;
  if (typeof window !== "undefined" && origin === window.location.origin) return true;
  if (origin === "https://pnrs.is-a.dev") return true;
  if (/^http:\/\/localhost:(808[0-9]|888[0-9])$/.test(origin)) return true;
  if (Array.isArray(TripStewardApp?.peerNodes)) {
    for (const node of TripStewardApp.peerNodes) {
      try {
        if (new URL(node.url).origin === origin) return true;
      } catch {}
    }
  }
  return false;
}

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalizeJson).join(",") + "]";
  return "{" + Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(",") + "}";
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}

function base64ToBuffer(base64) {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  return Buffer.from(base64, "base64");
}

function getApiEndpoint(path) {
  const cleanPath = path.replace(/^\//, "");
  if (typeof window !== "undefined" && window.location) {
    const p = window.location.pathname;
    if (p.includes("/tripsteward")) {
      return `/tripsteward/${cleanPath}`;
    }
  }
  return `/${cleanPath}`;
}

async function signActionReceipt(payload, options = {}) {
  const kid = options.kid || "harborview-key-1";
  const provider = options.provider || "HarborView Boutique Hotel";

  // 1. In browser, use server-side signing endpoint with subpath awareness to ensure strict non-repudiation
  if (typeof fetch === "function") {
    try {
      const endpoint = getApiEndpoint("api/sign-receipt");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, kid, provider }),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
  }

  // 2. Fall back to secure local key (Node environment or ephemeral session key)
  try {
    const keyJwk = await getHarborViewSigningKey();
    if (!keyJwk) return null;
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const canonicalPayload = canonicalizeJson(payload);
    const data = new TextEncoder().encode(canonicalPayload);
    const key = await subtle.importKey("jwk", keyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const sigBuffer = await subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, key, data);
    return {
      version: "1.0.0",
      algorithm: "ES256",
      kid: keyJwk.kid || kid,
      provider,
      issuedAt: new Date().toISOString(),
      payload,
      canonicalPayload,
      signature: bufferToBase64(sigBuffer),
      ...(keyJwk.publicKeyJwk ? { publicKeyJwk: keyJwk.publicKeyJwk } : {})
    };
  } catch (err) {
    console.warn("Could not sign receipt:", err);
    return null;
  }
}

async function verifyActionReceipt(receiptObj, publicKeyJwk) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { valid: false, error: "WebCrypto not available" };
  if (!receiptObj?.signature || !receiptObj?.payload) return { valid: false, error: "Missing signature/payload" };
  try {
    const canonicalPayload = receiptObj.canonicalPayload || canonicalizeJson(receiptObj.payload);
    const data = new TextEncoder().encode(canonicalPayload);
    const sigBuffer = base64ToBuffer(receiptObj.signature);
    const key = await subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await subtle.verify({ name: "ECDSA", hash: { name: "SHA-256" } }, key, sigBuffer, data);
    return { valid, provider: receiptObj.provider, kid: receiptObj.kid, issuedAt: receiptObj.issuedAt };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Genuine ISO/IEC 18004 Standard QR Code Generator (Model 2, Version 1, Level M).
 */
function generateISO18004QR(code, size = 96) {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let val = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = val;
    exp[i + 255] = val;
    log[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11D : 0);
  }

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return exp[log[x] + log[y]];
  }

  const genPoly = [1, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45];
  const inputBytes = new TextEncoder().encode(String(code).slice(0, 14));
  const data = new Uint8Array(16);
  let bitPos = 0;

  function writeBits(bits, len) {
    for (let i = len - 1; i >= 0; i--) {
      const bit = (bits >> i) & 1;
      const byteIdx = bitPos >> 3;
      const bitIdx = 7 - (bitPos & 7);
      if (byteIdx < 16) data[byteIdx] |= (bit << bitIdx);
      bitPos++;
    }
  }

  writeBits(0b0100, 4);
  writeBits(inputBytes.length, 8);
  for (let i = 0; i < inputBytes.length; i++) writeBits(inputBytes[i], 8);
  writeBits(0, 4);
  if (bitPos % 8 !== 0) bitPos += (8 - (bitPos % 8));
  let padByte = 0xEC;
  while ((bitPos >> 3) < 16) {
    data[bitPos >> 3] = padByte;
    padByte = padByte === 0xEC ? 0x11 : 0xEC;
    bitPos += 8;
  }

  const ec = new Uint8Array(10);
  for (let i = 0; i < 16; i++) {
    const feedback = data[i] ^ ec[0];
    for (let j = 0; j < 9; j++) {
      ec[j] = ec[j + 1] ^ gfMul(feedback, genPoly[j + 1]);
    }
    ec[9] = gfMul(feedback, genPoly[10]);
  }

  const allCodewords = new Uint8Array(26);
  allCodewords.set(data, 0);
  allCodewords.set(ec, 16);

  const grid = Array.from({ length: 21 }, () => new Int8Array(21).fill(-1));

  function drawFinder(r0, c0) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
        const isCenter = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        grid[r0 + r][c0 + c] = (isBorder || isCenter) ? 1 : 0;
      }
    }
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          const row = r0 + r;
          const col = c0 + c;
          if (row >= 0 && row < 21 && col >= 0 && col < 21) grid[row][col] = 0;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, 14);
  drawFinder(14, 0);

  for (let i = 8; i <= 12; i++) {
    grid[6][i] = (i % 2 === 0) ? 1 : 0;
    grid[i][6] = (i % 2 === 0) ? 1 : 0;
  }
  grid[13][8] = 1;

  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const tlCoords = [
    [8,0], [8,1], [8,2], [8,3], [8,4], [8,5], [8,7], [8,8],
    [7,8], [5,8], [4,8], [3,8], [2,8], [1,8], [0,8]
  ];
  for (let i = 0; i < 15; i++) grid[tlCoords[i][0]][tlCoords[i][1]] = formatBits[i];
  for (let i = 0; i < 7; i++) grid[20 - i][8] = formatBits[i];
  for (let i = 0; i < 8; i++) grid[8][13 + i] = formatBits[7 + i];

  let codewordIdx = 0;
  let bitIndex = 7;
  let upward = true;

  for (let right = 20; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < 21; vert++) {
      const row = upward ? (20 - vert) : vert;
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = right - colOffset;
        if (grid[row][col] === -1) {
          let bit = 0;
          if (codewordIdx < 26) {
            bit = (allCodewords[codewordIdx] >> bitIndex) & 1;
            bitIndex--;
            if (bitIndex < 0) {
              bitIndex = 7;
              codewordIdx++;
            }
          }
          if ((row + col) % 2 === 0) bit ^= 1;
          grid[row][col] = bit;
        }
      }
    }
    upward = !upward;
  }

  const cellSize = size / 21;
  let rects = "";
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      if (grid[r][c] === 1) {
        rects += `<rect x="${(c * cellSize).toFixed(1)}" y="${(r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="#0f172a" />`;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="border-radius: 6px; background: #ffffff; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><rect width="${size}" height="${size}" fill="#ffffff"/>${rects}</svg>`;
}

function generateICS(itinerary, bookings) {
  const pad = (n) => String(n).padStart(2, "0");
  const formatDate = (date) => {
    return date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) + "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) + "Z";
  };
  const now = formatDate(new Date());

  let events = [];

  if (bookings.hotel) {
    events.push(`BEGIN:VEVENT
UID:hotel-${bookings.hotel.id || 'res'}@tripsteward.openagenticweb.org
DTSTAMP:${now}
DTSTART:20261127T230000Z
DTEND:20261129T180000Z
SUMMARY:🏨 HarborView Hotel Stay (${bookings.hotel.room_tier})
DESCRIPTION:Direct Reservation Ref: ${bookings.hotel.id}\\nRate: $${bookings.hotel.nightly_rate_usd}/night (${bookings.hotel.nights} nights)\\n0% OTA Commission Direct Provider Booking
LOCATION:HarborView Hotel, 450 Waterfront Blvd
STATUS:CONFIRMED
END:VEVENT`);
  }

  if (bookings.transfer) {
    events.push(`BEGIN:VEVENT
UID:transfer-${bookings.transfer.id || 'res'}@tripsteward.openagenticweb.org
DTSTAMP:${now}
DTSTART:20261127T170000Z
DTEND:20261127T174500Z
SUMMARY:🚗 CityGlide Airport Chauffeur (${bookings.transfer.vehicle_class})
DESCRIPTION:Transfer Ref: ${bookings.transfer.id}\\nDriver: ${bookings.transfer.driver || 'Chauffeur Dispatched'}\\nFlight Telemetry Synced
LOCATION:${bookings.transfer.pickup_location || 'Airport Curbside'}
STATUS:CONFIRMED
END:VEVENT`);
  }

  if (bookings.exp) {
    events.push(`BEGIN:VEVENT
UID:exp-${bookings.exp.id || 'res'}@tripsteward.openagenticweb.org
DTSTAMP:${now}
DTSTART:20261128T180000Z
DTEND:20261128T200000Z
SUMMARY:⛵ MetroPass (${bookings.exp.experience_name})
DESCRIPTION:Voucher Ref: ${bookings.exp.id}\\nPasses: ${bookings.exp.tickets} Guest(s)\\nDirect Total: $${bookings.exp.total_price_usd}\\nDigital QR Pass Verified
LOCATION:Pier 39, Marina Gate B
STATUS:CONFIRMED
END:VEVENT`);
  }

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TripSteward//Open Agentic Web Concierge//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:TripSteward Master Itinerary
${events.join("\n")}
END:VCALENDAR`;
}

function downloadICS(filename, content) {
  if (typeof Blob === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
    const dest = data.destination || this.activeJourney.destination;
    this.activeJourney.destination = dest;
    this.activeJourney.dates = data.dates || this.activeJourney.dates;
    this.activeJourney.flight_details = data.flight_details || this.activeJourney.flight_details;
    this.activeJourney.target_budget_usd = data.target_budget_usd || this.activeJourney.target_budget_usd;
    this.activeJourney.title = `Journey to ${this.activeJourney.destination}`;

    const destLower = dest.toLowerCase();
    if (destLower.includes("seattle")) {
      this.activeJourney.flight_details = data.flight_details || "Delta Air Lines DL 1194 • SEA Arrival: Friday 3:45 PM";
      this.activeJourney.room_options = [
        { tier: "Deluxe Puget Sound View", rate: 215, status: "AVAILABLE", view: "Panoramic Waterfront & Olympic Mountains" },
        { tier: "Downtown Executive Suite", rate: 245, status: "AVAILABLE", view: "Skyline & Pike Place Views" },
        { tier: "Space Needle View Penthouse", rate: 390, status: "AVAILABLE", view: "Private Top-Floor Terrace" }
      ];
      this.activeJourney.demo_script = {
        prompt: "TripSteward Concierge, please coordinate my journey for Seattle. Reserve a quiet room at HarborView under $250/night, coordinate a private airport transfer with CityGlide for my flight arriving at 3:45 PM, and book two sunset whale and harbor sail passes with MetroPass.",
        cityglide_response: "CityGlide Transfer Dispatch confirmed: Vehicle 'Executive EV Sedan' (Lucid Air) assigned. Flight DL 1194 tracked in real-time. Pickup locked for 4:15 PM at SEA-Tac Priority Curbside. Direct transit time to HarborView: 24 mins. Fixed Fare: $68.00 USD (Ref: #CG-TRANS-6120).",
        metropass_response: "MetroPass Experiences Curator confirmed: Reserved 2x VIP Tickets for 'Puget Sound Sunset Whale & Harbor Sail' on Saturday, Nov 28 at 5:00 PM. Total Price: $170.00 USD (Ref: #MP-PASS-4921).",
        itinerary: {
          trip_title: "Seattle Autumn Waterfront Retreat",
          destination: "Seattle, Washington",
          dates: "Nov 27 – Nov 29, 2026 (2 Nights)",
          total_cost_usd: 668.00,
          direct_savings_usd: 174.00,
          itinerary_highlights: [
            "🏨 HarborView Seattle: Deluxe Puget Sound View (2 Nights @ $215/night = $430)",
            "🚗 CityGlide Transfer: Executive EV Sedan (SEA-Tac to Hotel = $68)",
            "⛵ MetroPass Experience: 2x Puget Sound Sunset Whale Passes ($170)"
          ],
          concierge_notes: "Direct booking confirmed across all connected provider nodes. 0% middleman booking fees."
        }
      };
    } else if (destLower.includes("austin")) {
      this.activeJourney.flight_details = data.flight_details || "Southwest Airlines WN 2042 • AUS Arrival: Friday 2:15 PM";
      this.activeJourney.room_options = [
        { tier: "Lady Bird Lake View Queen", rate: 175, status: "AVAILABLE", view: "Waterfront & Downtown Skyline" },
        { tier: "Downtown Congress Executive Suite", rate: 210, status: "AVAILABLE", view: "Capitol & City Lights" },
        { tier: "Texas Hill Country View Penthouse", rate: 340, status: "AVAILABLE", view: "Panoramic Sunset Terrace" }
      ];
      this.activeJourney.demo_script = {
        prompt: "TripSteward Concierge, please coordinate my journey for Austin. Reserve a room under $200/night, coordinate a private airport transfer with CityGlide for my flight arriving at 2:15 PM, and book two sunset paddle and bat cruise tickets with MetroPass.",
        cityglide_response: "CityGlide Transfer Dispatch confirmed: Vehicle 'Executive EV Sedan' assigned. Flight WN 2042 tracked. Pickup at AUS Curbside. Fare: $68.00 USD (Ref: #CG-TRANS-3091).",
        metropass_response: "MetroPass Experiences Curator confirmed: Reserved 2x Passes for 'Lady Bird Lake Sunset Paddle & Bat Cruise' on Saturday, Nov 28. Total: $110.00 USD (Ref: #MP-PASS-2281).",
        itinerary: {
          trip_title: "Austin Hill Country & Waterfront Retreat",
          destination: "Austin, Texas",
          dates: "Nov 27 – Nov 29, 2026 (2 Nights)",
          total_cost_usd: 528.00,
          direct_savings_usd: 146.00,
          itinerary_highlights: [
            "🏨 HarborView Austin: Lady Bird Lake View Queen (2 Nights @ $175/night = $350)",
            "🚗 CityGlide Transfer: Executive EV Sedan (AUS to Hotel = $68)",
            "⛵ MetroPass Experience: 2x Lady Bird Sunset Paddle Passes ($110)"
          ],
          concierge_notes: "Direct booking confirmed across all connected provider nodes. 0% middleman booking fees."
        }
      };
    } else {
      this.activeJourney.flight_details = data.flight_details || "United Airlines UA 482 • SFO Arrival: Friday 4:30 PM";
      this.activeJourney.room_options = [
        { tier: "Deluxe Bay-View Queen", rate: 189, status: "AVAILABLE", view: "Panoramic Bay & Bridge View" },
        { tier: "Urban Executive Loft", rate: 220, status: "AVAILABLE", view: "Skyline & City Lights" },
        { tier: "Panoramic Harbor Penthouse", rate: 395, status: "AVAILABLE", view: "Private Wrap-Around Terrace" }
      ];
      this.activeJourney.demo_script = {
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
          concierge_notes: "Direct booking confirmed across all connected provider nodes. 0% middleman booking fees."
        }
      };
    }

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

  async addAgentOnTheFly(agentData = {}) {
    let nodeUrl = agentData.node_url || agentData.url;
    let agent = null;

    // Check if in catalog
    const catalogEntry = this.catalogAgents.find(a => a.id === agentData.id || (nodeUrl && a.url.includes(nodeUrl)));

    // Attempt manifest verification if fetch is available
    let manifest = null;
    let fetchError = null;
    if (typeof fetch === "function" && nodeUrl) {
      try {
        let manifestUrl = nodeUrl.replace(/\/$/, "");
        if (!manifestUrl.endsWith("agent-manifest.json")) {
          if (/\/[a-z0-9_-]+$/.test(manifestUrl) && !manifestUrl.endsWith("/alpine") && !manifestUrl.endsWith("/dining") && !manifestUrl.endsWith("/luggage") && !manifestUrl.endsWith("/insurance") && !manifestUrl.endsWith("/rides") && !manifestUrl.endsWith("/tripsteward") && !manifestUrl.endsWith("/experiences")) {
            manifestUrl = manifestUrl.replace(/\/[^/]+$/, "") + "/agent-manifest.json";
          } else {
            manifestUrl = manifestUrl + "/agent-manifest.json";
          }
        }
        const resp = await fetch(manifestUrl, { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          manifest = await resp.json();
        } else {
          fetchError = `HTTP ${resp.status}`;
        }
      } catch (e) {
        fetchError = e.message;
      }
    }

    // Fail closed: reject unreachable 404 endpoints unless explicitly declared programmatic agent definition
    const isExplicitDefinition = Boolean(agentData.name && agentData.front_man && agentData.name !== "Custom Agentic Web Node");
    if (!isExplicitDefinition && fetchError && (fetchError.includes("404") || fetchError.includes("Not Found"))) {
      return {
        ok: false,
        error: `Cannot mount agent node: Manifest not found at '${nodeUrl}' (${fetchError}).`
      };
    }

    if (catalogEntry) {
      agent = {
        ...catalogEntry,
        status: "CONNECTED"
      };
      if (manifest) {
        agent.tools = manifest.actions?.agentTools || agent.tools;
        if (manifest.brand) agent.name = manifest.brand;
      }
    } else if (nodeUrl) {
      const cleanName = (manifest?.brand || manifest?.name || agentData.name || "custom-agent").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      agent = {
        id: manifest?.id || `custom-${cleanName}`,
        name: manifest?.brand || manifest?.name || agentData.name || "Custom Agentic Web Node",
        role: manifest?.networks?.[0]?.front_man || agentData.role || `${agentData.category || 'Specialist'} Service Agent`,
        front_man: manifest?.networks?.[0]?.front_man || agentData.front_man || "service_specialist",
        url: nodeUrl,
        tools: manifest?.actions?.agentTools || agentData.tools || ["query_service", "book_direct"],
        category: agentData.category || manifest?.category || "Custom Service",
        description: manifest?.description || `External agentic node dynamically linked from ${nodeUrl}`,
        status: "CONNECTED",
        icon: "🔌"
      };
    } else {
      agent = {
        id: `custom-${Date.now()}`,
        name: agentData.name || "Custom Agentic Web Node",
        role: "Specialist Service Agent",
        front_man: "service_specialist",
        url: "",
        tools: ["query_service", "book_direct"],
        category: "Custom Service",
        description: "External custom agent node",
        status: "CONNECTED",
        icon: "🔌"
      };
    }

    if (!this.registeredAgents.some(a => a.id === agent.id)) {
      this.registeredAgents.push(agent);
    }

    // Wire dynamically to live in-browser engine if present
    try {
      const engine = window.__nsweb?.engine;
      if (engine && agent.url) {
        engine.runtimeAllowedPeers?.add(new URL(agent.url).origin);
        engine.top?.network?.setLink?.(agent.id, agent.url);
        const spec = engine.top?.network?.getAgentSpec?.(engine.top.network.findFrontMan());
        if (spec && Array.isArray(spec.tools) && !spec.tools.includes(agent.url)) {
          spec.tools.push(agent.url);
        }
      }
    } catch (e) {
      console.warn("Could not wire agent to live engine:", e);
    }

    if (typeof TripStewardApp !== "undefined") {
      if (typeof TripStewardApp.renderSwarm === "function") TripStewardApp.renderSwarm();
      if (typeof TripStewardApp.renderDynamicCards === "function") TripStewardApp.renderDynamicCards();
      if (typeof TripStewardApp.appendSimulatedMessage === "function") {
        TripStewardApp.appendSimulatedMessage("bot", `🔌 **Orchestrator Link:** Successfully mounted new agent **${agent.name}** (${agent.url}) on the fly. Declared machine tools: \`${(agent.tools || []).join("`, `")}\`.`);
      }
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

  async reserveHotelRoom(room) {
    const id = "HV-STAY-" + Math.floor(10000 + Math.random() * 90000);
    const cost = (room.nightly_rate_usd || 189) * (room.nights || 2);

    // 1. Sync and lock room in shared inventory first
    if (typeof fetch === "function") {
      try {
        await fetch(getApiEndpoint("api/inventory"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "hold_room",
            room_id: id,
            guest: room.guest_names || this.activeJourney?.traveler?.name || "Dr. Rachel Chen",
            total_stay_cost: cost
          }),
          signal: AbortSignal.timeout(1500)
        });
      } catch {}
    }

    // 2. Request cryptographically verified receipt from server
    const receipt = await signActionReceipt({
      reservation_id: id,
      room_tier: room.room_tier || "Deluxe Bay-View Queen",
      nightly_rate_usd: room.nightly_rate_usd || 189,
      nights: room.nights || 2,
      guest_names: room.guest_names || this.activeJourney?.traveler?.name || "Dr. Rachel Chen",
      total_stay_cost: cost
    }, {
      kid: "harborview-key-1",
      provider: "HarborView Boutique Hotel"
    });

    this.hotelReservation = {
      id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "RESERVED_DIRECT",
      receipt,
      ...room
    };
    TripStewardApp.renderBookings();
    return {
      ok: true,
      reservation_id: this.hotelReservation.id,
      total_stay_cost: cost,
      receipt,
      message: `HarborView room '${room.room_tier}' successfully reserved for ${room.nights} nights.`
    };
  }

  async bookAirportTransfer(transfer) {
    const id = "CG-TRANS-" + Math.floor(10000 + Math.random() * 90000);
    const fare = transfer.fare_usd || 68.00;

    // 1. Sync and lock dispatch in shared fleet inventory first
    if (typeof fetch === "function") {
      try {
        await fetch(getApiEndpoint("api/inventory"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "dispatch_ride",
            transfer_id: id,
            vehicle_class: transfer.vehicle_class || "Executive EV Sedan",
            fare_usd: fare
          }),
          signal: AbortSignal.timeout(1500)
        });
      } catch {}
    }

    // 2. Request cryptographically verified receipt for CityGlide transfer
    const receipt = await signActionReceipt({
      transfer_id: id,
      passenger_name: this.activeJourney?.traveler?.name || "Elena Rostova",
      vehicle_class: transfer.vehicle_class || "Executive EV Sedan",
      driver: "Marcus Vance (Lucid Air Grand Touring #01)",
      pickup_location: transfer.pickup_location || "SFO Terminal 2 - Baggage Carousel 4",
      dropoff_location: transfer.dropoff_location || "HarborView Hotel, 450 Waterfront Blvd",
      pickup_time: transfer.pickup_time || "5:00 PM (UA 482 flight buffer)",
      fare_usd: fare
    }, {
      kid: "cityglide-key-1",
      provider: "CityGlide Autonomous Fleet"
    });

    this.airportTransfer = {
      id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "DISPATCHED_ON_NETWORK",
      receipt,
      ...transfer
    };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("oaw_provider_events");
        ch.postMessage({
          type: "cityglide_transfer_scheduled",
          reservation: {
            transfer_id: this.airportTransfer.id,
            passenger_name: this.activeJourney?.traveler?.name || "Elena Rostova",
            vehicle_class: transfer.vehicle_class || "Executive EV Sedan",
            driver: "Marcus Vance (Lucid Air Grand Touring #01)",
            pickup_location: transfer.pickup_location || "SFO Terminal 2 - Baggage Carousel 4",
            dropoff_location: transfer.dropoff_location || "HarborView Hotel, 450 Waterfront Blvd",
            pickup_time: transfer.pickup_time || "5:00 PM (UA 482 flight buffer)",
            fare_usd: fare,
            status: "CONFIRMED_DISPATCHED",
            receipt,
            created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        });
        ch.close();
      }
    } catch (e) {}
    TripStewardApp.renderBookings();
    return {
      ok: true,
      transfer_booking_id: this.airportTransfer.id,
      fare_usd: fare,
      receipt,
      message: `CityGlide ${transfer.vehicle_class} transfer scheduled for ${transfer.pickup_time}.`
    };
  }

  async bookCityExperience(exp) {
    const id = "MP-PASS-" + Math.floor(10000 + Math.random() * 90000);
    const tickets = exp.tickets_count || 2;
    const price = exp.total_price_usd || 158.00;

    // 1. Sync and lock pass in shared experiences inventory first
    if (typeof fetch === "function") {
      try {
        await fetch(getApiEndpoint("api/inventory"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "issue_pass",
            pass_code: id,
            title: exp.experience_name || "Golden Gate Sunset Catamaran Cruise",
            tickets,
            total_price_usd: price
          }),
          signal: AbortSignal.timeout(1500)
        });
      } catch {}
    }

    // 2. Request cryptographically verified receipt for MetroPass voucher
    const receipt = await signActionReceipt({
      pass_code: id,
      experience_id: "EXP-SF-01",
      title: exp.experience_name || "Golden Gate Sunset Catamaran Cruise",
      attendee_name: this.activeJourney?.traveler?.name || "Elena Rostova",
      date: "Saturday, Nov 28",
      tickets,
      total_price_usd: price
    }, {
      kid: "metropass-key-1",
      provider: "MetroPass Experiences"
    });

    this.cityExperience = {
      id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "CONFIRMED_VOUCHER_ISSUED",
      receipt,
      ...exp
    };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("oaw_provider_events");
        ch.postMessage({
          type: "metropass_pass_booked",
          booking: {
            pass_code: this.cityExperience.id,
            experience_id: "EXP-SF-01",
            title: exp.experience_name || "Golden Gate Sunset Catamaran Cruise",
            attendee_name: this.activeJourney?.traveler?.name || "Elena Rostova",
            date: "Saturday, Nov 28",
            scheduled_slot: exp.scheduled_slot || "6:00 PM - 8:00 PM",
            tickets,
            total_price_usd: price,
            status: "CONFIRMED_ISSUED",
            receipt,
            qr_code: "QR-" + this.cityExperience.id,
            issued_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        });
        ch.close();
      }
    } catch (e) {}
    TripStewardApp.renderBookings();
    return {
      ok: true,
      experience_pass_id: this.cityExperience.id,
      total_price_usd: price,
      receipt,
      message: `MetroPass confirmed ${tickets}x tickets for '${exp.experience_name}'.`
    };
  }

  compileMasterItinerary(itinerary = {}) {
    const hotelCost = this.hotelReservation ? (this.hotelReservation.nightly_rate_usd * this.hotelReservation.nights) : 0;
    const transferCost = this.airportTransfer ? this.airportTransfer.fare_usd : 0;
    const expCost = this.cityExperience ? this.cityExperience.total_price_usd : 0;
    let extraCost = 0;
    for (const eb of this.extraBookings) {
      extraCost += Number(eb.total_cost_usd || eb.price_usd || 0);
    }
    const verifiedTotal = (hotelCost + transferCost + expCost + extraCost) || itinerary.total_cost_usd || 604.00;
    const verifiedSavings = itinerary.direct_savings_usd || Math.round(verifiedTotal * 0.266);

    this.masterItinerary = {
      generated_at: new Date().toISOString(),
      trip_code: this.activeJourney.code,
      total_cost_usd: verifiedTotal,
      direct_savings_usd: verifiedSavings,
      has_verified_reservations: Boolean(this.hotelReservation || this.airportTransfer || this.cityExperience),
      ...itinerary
    };
    this.masterItinerary.total_cost_usd = verifiedTotal;
    this.masterItinerary.direct_savings_usd = verifiedSavings;

    TripStewardApp.renderItinerary();
    return {
      ok: true,
      status: "COMMITTED_TO_CLIENT_SESSION",
      itinerary_id: itinerary.itinerary_id || ("TS-ITIN-" + Math.floor(100000 + Math.random() * 900000)),
      verified_total_usd: verifiedTotal,
      direct_savings_usd: verifiedSavings,
      total_reservations_sealed: (this.hotelReservation ? 1 : 0) + (this.airportTransfer ? 1 : 0) + (this.cityExperience ? 1 : 0) + this.extraBookings.length,
      download_available: true,
      message: `Unified Master Travel Itinerary synthesized with $${verifiedTotal} direct cost and $${verifiedSavings} direct savings.`
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
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("oaw_provider_events");
        ch.onmessage = (e) => {
          if (e.data?.type === "cityglide_transfer_scheduled" && e.data.reservation) {
            const r = e.data.reservation;
            TripStewardApp.vault.airportTransfer = {
              id: r.transfer_id,
              status: "CONFIRMED_DISPATCHED",
              vehicle_class: r.vehicle_class,
              driver: r.driver,
              pickup_time: r.pickup_time,
              fare_usd: r.fare_usd,
              receipt: r.receipt || e.data?.receipt || null
            };
            TripStewardApp.renderBookings();
          } else if (e.data?.type === "metropass_pass_booked" && e.data.booking) {
            const b = e.data.booking;
            TripStewardApp.vault.cityExperience = {
              id: b.pass_code,
              status: "CONFIRMED_ISSUED",
              experience_name: b.title,
              tickets_count: b.tickets,
              total_price_usd: b.total_price_usd,
              receipt: b.receipt || e.data?.receipt || null
            };
            TripStewardApp.renderBookings();
          }
        };
      }
      if (typeof window !== "undefined") {
        window.addEventListener("message", (e) => {
          if (!isAllowedPeerOrigin(e.origin)) {
            return;
          }
          const data = e.data?.payload || e.data;
          if (data?.type === "cityglide_transfer_scheduled" && data.reservation) {
            const r = data.reservation;
            TripStewardApp.vault.airportTransfer = {
              id: r.transfer_id,
              status: "CONFIRMED_DISPATCHED",
              vehicle_class: r.vehicle_class,
              driver: r.driver,
              pickup_time: r.pickup_time,
              fare_usd: r.fare_usd,
              receipt: r.receipt || data.receipt || null
            };
            TripStewardApp.renderBookings();
          } else if (data?.type === "metropass_pass_booked" && data.booking) {
            const b = data.booking;
            TripStewardApp.vault.cityExperience = {
              id: b.pass_code,
              status: "CONFIRMED_ISSUED",
              experience_name: b.title,
              tickets_count: b.tickets,
              total_price_usd: b.total_price_usd,
              receipt: b.receipt || data.receipt || null
            };
            TripStewardApp.renderBookings();
          }
        });
      }
    } catch (e) {}

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
          showToast("Copied sample prompt to clipboard! Paste it into the orchestrator chat below.", "info");
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

    const exportIcsBtn = document.querySelector("#export-ics-btn");
    if (exportIcsBtn) {
      exportIcsBtn.addEventListener("click", () => {
        const bookings = {
          hotel: TripStewardApp.vault.hotelReservation,
          transfer: TripStewardApp.vault.airportTransfer,
          exp: TripStewardApp.vault.cityExperience
        };
        const icsContent = generateICS(TripStewardApp.vault.masterItinerary, bookings);
        downloadICS("tripsteward-itinerary.ics", icsContent);
        showToast("Exported RFC 5545 .ics Calendar pass!", "success");
      });
    }

    const toggleInspectorBtn = document.querySelector("#toggle-inspector-btn");
    const closeInspectorBtn = document.querySelector("#close-inspector-btn");
    const inspectorDrawer = document.querySelector("#inspector-drawer");
    if (toggleInspectorBtn && inspectorDrawer) {
      toggleInspectorBtn.addEventListener("click", () => {
        const isHidden = inspectorDrawer.style.display === "none";
        inspectorDrawer.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          TripStewardApp.renderInspectorReceipts();
          inspectorDrawer.scrollIntoView({ behavior: "smooth" });
        }
      });
    }
    if (closeInspectorBtn && inspectorDrawer) {
      closeInspectorBtn.addEventListener("click", () => {
        inspectorDrawer.style.display = "none";
      });
    }

    const verifyBtn = document.querySelector("#verify-signatures-btn");
    if (verifyBtn) {
      verifyBtn.addEventListener("click", () => TripStewardApp.verifySignatures(false));
    }

    const tamperBtn = document.querySelector("#tamper-test-btn");
    if (tamperBtn) {
      tamperBtn.addEventListener("click", () => TripStewardApp.verifySignatures(true));
    }

    TripStewardApp.initTelemetry();
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

    TripStewardApp.renderDynamicCards();
  }

  static renderDynamicCards() {
    const container = document.querySelector("#dynamic-provider-cards-container");
    if (!container) return;
    const dynamicAgents = TripStewardApp.vault.registeredAgents.filter(
      a => a.id !== "cityglide" && a.id !== "metropass"
    );

    if (dynamicAgents.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = dynamicAgents.map(agent => {
      const booked = TripStewardApp.vault.extraBookings.find(b => b.agent_id === agent.id);
      return `
        <article class="provider-card dynamic-provider-card" id="card-${escapeHtml(agent.id)}" style="margin-top: 16px; border: 1px solid rgba(14,165,233,0.3); background: #ffffff; border-radius: 12px; padding: 20px;">
          <div class="provider-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div class="provider-brand" style="display: flex; gap: 12px; align-items: center;">
              <span class="provider-logo" style="font-size: 1.8rem;">${escapeHtml(agent.icon || "🔌")}</span>
              <div>
                <h3 class="provider-name" style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #0f172a;">${escapeHtml(agent.name)}</h3>
                <p class="provider-category" style="margin: 2px 0 0; font-size: 0.85rem; color: #64748b;">${escapeHtml(agent.category || "Specialist Node")} • ${escapeHtml(agent.role || agent.front_man)}</p>
              </div>
            </div>
            <span class="status-pill ${booked ? 'status-confirmed' : 'status-ready'}">
              ${booked ? '✓ Direct Booking Active' : '● Node Connected'}
            </span>
          </div>
          <p class="provider-desc" style="font-size: 0.9rem; color: #334155; line-height: 1.4; margin-bottom: 12px;">${escapeHtml(agent.description || "Federated specialist agent mounted to the active traveler swarm.")}</p>
          <div class="tool-tags-container" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">
            ${(agent.tools || []).map(t => `<span class="badge" style="background: rgba(14,165,233,0.08); color: #0284c7; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-family: monospace;">⚡ ${escapeHtml(t)}</span>`).join("")}
          </div>
          <div class="card-actions-bar" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            <button class="btn-card-action" onclick="TripStewardApp.bookDynamicSpecialist('${escapeHtml(agent.id)}')">
              <span>${booked ? '✓ Service Booked Directly' : `Book Direct with ${escapeHtml(agent.name.split(" ")[0])}`}</span>
            </button>
            <div class="status-pill ${booked ? 'status-confirmed' : 'status-ready'}">
              ${booked ? `Ref: #${escapeHtml(booked.ref_id)}` : 'Zero Intermediary Markup'}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  static async bookDynamicSpecialist(agentId) {
    const agent = TripStewardApp.vault.registeredAgents.find(a => a.id === agentId);
    if (!agent) return;

    let existing = TripStewardApp.vault.extraBookings.find(b => b.agent_id === agentId);
    if (existing) {
      showToast(`Booking already active for ${agent.name} (Ref: ${existing.ref_id}).`, "info");
      return;
    }

    let defaultPrice = 50.00;
    let title = `${agent.name} Specialist Reservation`;
    let actionName = "book_direct";
    let actionPayload = {};

    if (agentId === "tablebespoke") {
      defaultPrice = 210.00;
      title = "TableBespoke Atelier Crenn Tasting Table";
      actionName = "reserve_dining_table";
      actionPayload = { restaurant_name: "Atelier Crenn", party_size: 2, reservation_time: "7:30 PM", dietary_notes: "None" };
    } else if (agentId === "alpinetrail") {
      defaultPrice = 85.00;
      title = "AlpineTrail Wilderness Permit & Guide Pass";
      actionName = "book_expedition_pass";
      actionPayload = { destination: "Mount Tamalpais Wilderness Trail", participants: 2, date: "2026-11-29" };
    } else if (agentId === "luggagefly") {
      defaultPrice = 70.00;
      title = "LuggageFly Airport Curbside Courier (2 Bags)";
      actionName = "schedule_baggage_transfer";
      actionPayload = { passenger_name: "Dr. Rachel Chen", hotel_address: "HarborView Hotel, 450 Waterfront Blvd", flight_number: "UA 482", bags_count: 2 };
    } else if (agentId === "travelshield") {
      defaultPrice = 19.00;
      title = "TravelShield Flight Delay Parametric Policy";
      actionName = "file_instant_claim";
      actionPayload = { traveler_name: "Dr. Rachel Chen", flight_number: "UA 482", payout_destination: "Direct ACH / Instant Card" };
    }

    let bookingRef = `EXT-${Math.floor(1000 + Math.random() * 9000)}`;

    // Invoke peer node's action bridge when running in a live browser
    if (typeof window !== "undefined" && agent.url) {
      try {
        let oaw = window.openAgenticWeb;
        if (!oaw && typeof importShim === "function") {
          oaw = await importShim("open-agentic-web").catch(() => null);
        } else if (!oaw) {
          oaw = await import("open-agentic-web").catch(() => null);
        }
        if (oaw && typeof oaw.createActionBridgeClient === "function") {
          const bridgeUrl = `${agent.url.replace(/\/[^/]+$/, "")}/bridge/action-bridge.html`;
          const client = oaw.createActionBridgeClient({ bridgeUrl, brand: agent.name });
          const res = await client.execute(actionName, actionPayload, { timeoutMs: 3500 }).catch(() => null);
          if (res && res.ok) {
            bookingRef = res.reservation_id || res.pass_id || res.tracking_id || res.policy_id || res.booking_id || bookingRef;
            if (typeof res.total === "number") defaultPrice = res.total;
            else if (typeof res.rate_usd === "number") defaultPrice = res.rate_usd;
            else if (typeof res.premium_paid_usd === "number") defaultPrice = res.premium_paid_usd;
            else if (typeof res.total_cost_usd === "number") defaultPrice = res.total_cost_usd;
          }
          if (typeof client.dispose === "function") client.dispose();
        }
      } catch (err) {
        console.warn("Peer bridge invocation fallback:", err);
      }
    }

    const booking = {
      agent_id: agentId,
      ref_id: bookingRef,
      title: title,
      total_cost_usd: defaultPrice,
      savings_usd: Math.round(defaultPrice * 0.25),
      status: "CONFIRMED_DIRECT"
    };

    TripStewardApp.vault.extraBookings.push(booking);
    TripStewardApp.appendSimulatedMessage("bot", `✅ **Direct Booking Confirmed:** Secured **${escapeHtml(title)}** directly with **${escapeHtml(agent.name)}** for **$${defaultPrice.toFixed(2)} USD** (Direct booking benefit: zero OTA markup).`);
    TripStewardApp.renderBookings();
    TripStewardApp.renderDynamicCards();
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
    const selectedTier = TripStewardApp.vault.selectedRoomTier;
    const selectedRate = TripStewardApp.vault.selectedRoomRate;
    const room = t.room_options.find(r => r.tier === selectedTier) || t.room_options[0];
    TripStewardApp.vault.reserveHotelRoom({
      room_tier: selectedTier || room.tier,
      nightly_rate_usd: selectedRate || room.rate,
      nights: 2,
      guest_names: t.traveler.name,
      amenities_included: ["Artisan Breakfast", "High-Speed Wi-Fi", "Late Check-out 1 PM"]
    });
  }

  static quickBookTransfer() {
    const t = TripStewardApp.vault.activeJourney;
    const isSeattle = t.destination.includes("Seattle");
    const isAustin = t.destination.includes("Austin");
    TripStewardApp.vault.bookAirportTransfer({
      pickup_location: t.flight_details,
      dropoff_location: isSeattle ? "HarborView Hotel, 100 Alaskan Way, Seattle" : (isAustin ? "HarborView Hotel, 208 Barton Springs Rd, Austin" : "HarborView Hotel, 450 Waterfront Blvd, San Francisco"),
      vehicle_class: "Executive EV Sedan (Lucid Air / Tesla Model S)",
      pickup_time: isSeattle ? "4:15 PM (DL 1194 flight buffer +30m)" : (isAustin ? "2:45 PM (WN 2042 flight buffer +30m)" : "5:00 PM (UA 482 flight buffer +30m)"),
      fare_usd: 68.00
    });
  }

  static quickBookExperience() {
    const t = TripStewardApp.vault.activeJourney;
    const isSeattle = t.destination.includes("Seattle");
    const isAustin = t.destination.includes("Austin");
    TripStewardApp.vault.bookCityExperience({
      experience_name: isSeattle ? "Puget Sound Islands Catamaran Sail" : (isAustin ? "Lady Bird Lake Sunset Kayak & Bat Tour" : "Golden Gate Sunset Catamaran Cruise"),
      scheduled_slot: isSeattle ? "Saturday, 5:30 PM – 7:30 PM" : (isAustin ? "Saturday, 6:00 PM – 8:00 PM" : "Saturday, 5:45 PM – 7:30 PM"),
      tickets_count: t.traveler.party_size,
      total_price_usd: 158.00,
      special_notes: isSeattle ? "Boarding at Pier 55, Seattle Waterfront" : (isAustin ? "Meeting at Congress Ave Bridge" : "Boarding at Pier 39, Marina Gate B")
    });
  }

  static selectRoomTier(tier, rate) {
    TripStewardApp.vault.selectedRoomTier = tier;
    TripStewardApp.vault.selectedRoomRate = rate;
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
    const hotelBtn = document.querySelector("#book-hotel-manual-btn");
    if (hotelBtn && !TripStewardApp.vault.hotelReservation) {
      hotelBtn.textContent = `Hold Room Directly ($${rate}/nt)`;
    }
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

    // Dynamic city labels and addresses across middle provider cards
    const isSeattle = t.destination.includes("Seattle");
    const isAustin = t.destination.includes("Austin");

    const hotelAddr = document.querySelector("#hotel-card-address");
    const transferAddr = document.querySelector("#transfer-card-address");
    const telemTitle = document.querySelector("#transfer-telemetry-title");
    const telemDesc = document.querySelector("#transfer-telemetry-desc");
    const expTitle = document.querySelector("#experience-card-title");
    const expAddr = document.querySelector("#experience-card-address");
    const expDesc = document.querySelector("#experience-card-desc");
    const chipTransfer = document.querySelector("#chip-book-transfer");
    const chipExp = document.querySelector("#chip-book-experience");

    if (isSeattle) {
      if (hotelAddr) hotelAddr.textContent = "100 Alaskan Way, Elliott Bay District, Seattle, WA";
      if (transferAddr) transferAddr.textContent = "SEA Airport Curbside ➔ HarborView Hotel";
      if (telemTitle) telemTitle.textContent = "Flight DL 1194 Arrival Tracking Active";
      if (telemDesc) telemDesc.innerHTML = "Scheduled landing: 3:45 PM. Automatic <strong>+30 min baggage buffer</strong> applied. Chauffeur curbside meet time set to <strong>4:15 PM – 4:30 PM</strong>.";
      if (expTitle) expTitle.textContent = "Puget Sound Islands Catamaran Sail";
      if (expAddr) expAddr.textContent = "Pier 55, Seattle Waterfront • Saturday, 5:30 PM – 7:30 PM";
      if (expDesc) expDesc.textContent = "Sail through Puget Sound with breathtaking sunset views of Mount Rainier and the Seattle skyline. Includes Pacific Northwest craft beverages.";
      if (chipTransfer) chipTransfer.textContent = "🚗 Schedule SEA Pickup";
      if (chipExp) chipExp.textContent = "⛵ Book Puget Sail";
    } else if (isAustin) {
      if (hotelAddr) hotelAddr.textContent = "208 Barton Springs Rd, South Congress District, Austin, TX";
      if (transferAddr) transferAddr.textContent = "AUS Airport Curbside ➔ HarborView Hotel";
      if (telemTitle) telemTitle.textContent = "Flight WN 2042 Arrival Tracking Active";
      if (telemDesc) telemDesc.innerHTML = "Scheduled landing: 2:15 PM. Automatic <strong>+30 min baggage buffer</strong> applied. Chauffeur curbside meet time set to <strong>2:45 PM – 3:00 PM</strong>.";
      if (expTitle) expTitle.textContent = "Lady Bird Lake Sunset Kayak & Bat Tour";
      if (expAddr) expAddr.textContent = "Congress Ave Bridge • Saturday, 6:00 PM – 8:00 PM";
      if (expDesc) expDesc.textContent = "Paddle along Lady Bird Lake at dusk to witness Austin's famous bat colony emergence with guided gear and local craft refreshments.";
      if (chipTransfer) chipTransfer.textContent = "🚗 Schedule AUS Pickup";
      if (chipExp) chipExp.textContent = "🦇 Book Bat Tour";
    } else {
      if (hotelAddr) hotelAddr.textContent = "450 Waterfront Blvd, Embarcadero District, San Francisco, CA";
      if (transferAddr) transferAddr.textContent = "SFO Terminal 2 Curbside ➔ HarborView Hotel";
      if (telemTitle) telemTitle.textContent = "Flight UA 482 Arrival Tracking Active";
      if (telemDesc) telemDesc.innerHTML = "Scheduled landing: 4:30 PM. Automatic <strong>+30 min baggage buffer</strong> applied. Chauffeur curbside meet time set to <strong>5:00 PM – 5:15 PM</strong>.";
      if (expTitle) expTitle.textContent = "Golden Gate Sunset Catamaran Cruise";
      if (expAddr) expAddr.textContent = "Pier 39, Marina Gate B • Saturday, 5:45 PM – 7:30 PM";
      if (expDesc) expDesc.textContent = "Sail past Alcatraz and beneath the Golden Gate Bridge aboard an executive 55ft catamaran. Includes California champagne, craft beers, and artisan cheese pairings.";
      if (chipTransfer) chipTransfer.textContent = "🚗 Schedule SFO Pickup";
      if (chipExp) chipExp.textContent = "⛵ Book Sunset Sail";
    }

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
        if (hotelBtn) hotelBtn.textContent = "Hold Room Directly ($189/nt)";
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
        if (transferBtn) transferBtn.textContent = "Dispatch Airport Chauffeur ($68)";
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
        if (expBtn) expBtn.textContent = "Issue 2x Passes ($158.00)";
      }
    }

    const hotelCost = hotel ? (hotel.nightly_rate_usd * hotel.nights) : 378;
    const transferCost = transfer ? transfer.fare_usd : 68;
    const expCost = exp ? exp.total_price_usd : 158;

    let extraCost = 0;
    const extraItems = Array.isArray(TripStewardApp.vault.extraBookings) ? TripStewardApp.vault.extraBookings : [];
    for (const eb of extraItems) {
      extraCost += Number(eb.total_cost_usd || eb.price_usd || 0);
    }

    const totalCost = hotelCost + transferCost + expCost + extraCost;
    const otaCost = (hotel || transfer || exp || extraItems.length > 0) ? Math.round(totalCost * 1.2666) : 765;

    const rHotel = document.querySelector("#receipt-hotel");
    const rTransfer = document.querySelector("#receipt-transfer");
    const rExp = document.querySelector("#receipt-exp");
    const rTotal = document.querySelector("#receipt-total");
    const rOta = document.querySelector("#receipt-ota");

    if (rHotel) rHotel.textContent = `$${hotelCost.toFixed(2)}`;
    if (rTransfer) rTransfer.textContent = `$${transferCost.toFixed(2)}`;
    if (rExp) rExp.textContent = `$${expCost.toFixed(2)}`;

    const rExtraContainer = document.querySelector("#receipt-extra-items");
    if (rExtraContainer) {
      if (extraItems.length > 0) {
        rExtraContainer.innerHTML = extraItems.map(eb => `
          <div class="receipt-row" style="margin-top: 6px;">
            <span class="receipt-name">✦ ${escapeHtml(eb.title || "Specialist Reservation")}</span>
            <span class="receipt-price">$${Number(eb.total_cost_usd || 0).toFixed(2)}</span>
          </div>
        `).join("");
      } else {
        rExtraContainer.innerHTML = "";
      }
    }

    if (rTotal) rTotal.textContent = `$${totalCost.toFixed(2)}`;
    if (rOta) rOta.textContent = `$${otaCost.toFixed(2)}`;

    const savingsBox = document.querySelector(".savings-highlight-box strong");
    if (savingsBox) {
      savingsBox.textContent = `$${(otaCost - totalCost).toFixed(2)} USD`;
    }

    const count = (hotel ? 1 : 0) + (transfer ? 1 : 0) + (exp ? 1 : 0) + extraItems.length;
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
          ${hotel ? `
            <div class="confirmed-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <div style="font-weight: 600; color: #0f172a;">🏨 Hotel: ${escapeHtml(hotel.room_tier)}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Ref: ${escapeHtml(hotel.id)} • $${hotel.nightly_rate_usd}/night (${hotel.nights} nights)</div>
              ${hotel.receipt ? `<div style="font-size: 10px; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">🔏 ECDSA Signed (ES256 • ${escapeHtml(hotel.receipt.kid)})</div>` : ''}
            </div>
          ` : ''}
          ${transfer ? `
            <div class="confirmed-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <div style="font-weight: 600; color: #0f172a;">🚗 Ride: ${escapeHtml(transfer.vehicle_class)}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Ref: ${escapeHtml(transfer.id)} • Fare: $${transfer.fare_usd} • Driver: ${escapeHtml(transfer.driver || 'Assigned')}</div>
              ${transfer.receipt ? `<div style="font-size: 10px; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">🔏 ECDSA Signed (ES256 • ${escapeHtml(transfer.receipt.kid)})</div>` : ''}
            </div>
          ` : ''}
          ${exp ? `
            <div class="confirmed-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
              <div>
                <div style="font-weight: 600; color: #0f172a;">⛵ Pass: ${escapeHtml(exp.experience_name)}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Ref: ${escapeHtml(exp.id)} • ${exp.tickets} Passes • Total: $${exp.total_price_usd}</div>
                ${exp.receipt ? `<div style="font-size: 10px; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">🔏 ECDSA Signed (ES256 • ${escapeHtml(exp.receipt.kid)})</div>` : ''}
              </div>
              <div class="iso-qr-wrapper" title="Scannable ISO/IEC 18004 Mobile Pass" style="flex-shrink: 0;">
                ${generateISO18004QR(exp.id, 64)}
              </div>
            </div>
          ` : ''}
        `;
      }
    }
    TripStewardApp.renderInspectorReceipts();
  }

  static renderInspectorReceipts() {
    const list = document.querySelector("#inspector-receipts-list");
    if (!list) return;

    const receipts = [];
    if (TripStewardApp.vault.hotelReservation?.receipt) {
      receipts.push(TripStewardApp.vault.hotelReservation.receipt);
    }
    if (TripStewardApp.vault.airportTransfer?.receipt) {
      receipts.push(TripStewardApp.vault.airportTransfer.receipt);
    }
    if (TripStewardApp.vault.cityExperience?.receipt) {
      receipts.push(TripStewardApp.vault.cityExperience.receipt);
    }

    if (receipts.length === 0) {
      list.innerHTML = `<div style="color: #64748b; font-size: 11px;">No provider action receipts signed in this session yet. Run the demo or book directly to generate WebCrypto signatures.</div>`;
      return;
    }

    list.innerHTML = receipts.map((r, i) => `
      <div style="background: #1e293b; padding: 8px; border-radius: 6px; border-left: 3px solid #38bdf8;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #f1f5f9;">${escapeHtml(r.provider)}</strong>
          <span style="color: #38bdf8; font-size: 10px;">${escapeHtml(r.kid)}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin: 2px 0;">Alg: ${escapeHtml(r.algorithm)} • Issued: ${escapeHtml(new Date(r.issuedAt).toLocaleTimeString())}</div>
        <div style="font-size: 10px; color: #cbd5e1; word-break: break-all;">Sig: ${escapeHtml(r.signature.slice(0, 32))}...</div>
      </div>
    `).join("");
  }

  static _jwksCache = new Map();

  static async resolveProviderPublicKey(receipt) {
    if (!receipt || !receipt.kid) return null;
    if (TripStewardApp._jwksCache.has(receipt.kid)) {
      return TripStewardApp._jwksCache.get(receipt.kid);
    }
    // 1. If receipt attached an ephemeral session public key
    if (receipt.publicKeyJwk && receipt.publicKeyJwk.kty === "EC") {
      TripStewardApp._jwksCache.set(receipt.kid, receipt.publicKeyJwk);
      return receipt.publicKeyJwk;
    }

    // 2. Query candidate /.well-known/jwks.json endpoints dynamically
    const candidateUrls = [
      "/.well-known/jwks.json",
      "/tripsteward/.well-known/jwks.json",
      "/rides/.well-known/jwks.json",
      "/experiences/.well-known/jwks.json",
      "http://localhost:8080/.well-known/jwks.json",
      "http://localhost:8081/.well-known/jwks.json",
      "http://localhost:8082/.well-known/jwks.json",
      "http://localhost:8880/.well-known/jwks.json",
      "http://localhost:8881/.well-known/jwks.json",
      "http://localhost:8882/.well-known/jwks.json"
    ];

    if (Array.isArray(TripStewardApp.peerNodes)) {
      for (const node of TripStewardApp.peerNodes) {
        try {
          const u = new URL(node.url);
          candidateUrls.push(`${u.origin}${u.pathname.replace(/\/$/, "")}/.well-known/jwks.json`);
          candidateUrls.push(`${u.origin}/.well-known/jwks.json`);
        } catch {}
      }
    }

    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data?.keys)) {
            for (const k of data.keys) {
              if (k.kid) TripStewardApp._jwksCache.set(k.kid, k);
            }
            if (TripStewardApp._jwksCache.has(receipt.kid)) {
              return TripStewardApp._jwksCache.get(receipt.kid);
            }
          }
        }
      } catch {}
    }

    // 3. Fallback for Node.js test environment
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const base = process.cwd();
        const testJwksPaths = [
          path.resolve(base, "sites", "tripsteward-hub", ".well-known", "jwks.json"),
          path.resolve(base, "sites", "cityglide-node", ".well-known", "jwks.json"),
          path.resolve(base, "sites", "metropass-node", ".well-known", "jwks.json")
        ];
        for (const p of testJwksPaths) {
          if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, "utf-8"));
            for (const k of data.keys || []) {
              if (k.kid) TripStewardApp._jwksCache.set(k.kid, k);
            }
          }
        }
        if (TripStewardApp._jwksCache.has(receipt.kid)) {
          return TripStewardApp._jwksCache.get(receipt.kid);
        }
      } catch {}
    }

    return null;
  }

  static async verifySignatures(tamper = false) {
    const out = document.querySelector("#verification-status-output");
    if (!out) return;

    const receipts = [];
    if (TripStewardApp.vault.hotelReservation?.receipt) {
      receipts.push({ name: "HarborView Hotel", receipt: { ...TripStewardApp.vault.hotelReservation.receipt } });
    }
    if (TripStewardApp.vault.airportTransfer?.receipt) {
      receipts.push({ name: "CityGlide Fleet", receipt: { ...TripStewardApp.vault.airportTransfer.receipt } });
    }
    if (TripStewardApp.vault.cityExperience?.receipt) {
      receipts.push({ name: "MetroPass Experiences", receipt: { ...TripStewardApp.vault.cityExperience.receipt } });
    }

    if (receipts.length === 0) {
      out.innerHTML = `<span style="color: #f59e0b;">⚠️ No signed receipts to verify. Reserve a service first.</span>`;
      return;
    }

    out.innerHTML = `<span style="color: #38bdf8;">⏳ Dynamically resolving JWKS and verifying ${receipts.length} signatures with WebCrypto...</span>`;

    let results = [];
    const t0 = performance.now();

    for (const item of receipts) {
      const r = item.receipt;
      const pubKey = await TripStewardApp.resolveProviderPublicKey(r);
      if (!pubKey) {
        results.push({ name: item.name, valid: false, error: `Public key not found in JWKS for kid: ${r.kid}` });
        continue;
      }

      if (tamper && item.name.includes("HarborView")) {
        // Tamper with payload
        r.payload = { ...r.payload, total_stay_cost: 9.99 };
        r.canonicalPayload = canonicalizeJson(r.payload);
      }

      const res = await verifyActionReceipt(r, pubKey);
      results.push({ name: item.name, valid: res.valid, kid: r.kid, error: res.error });
    }

    const duration = (performance.now() - t0).toFixed(2);

    const allValid = results.every(r => r.valid);
    out.innerHTML = `
      <div style="margin-top: 6px; padding: 8px; border-radius: 6px; background: ${allValid ? '#064e3b' : '#7f1d1d'}; color: white;">
        <strong>${allValid ? '✅ All ECDSA Signatures Cryptographically Valid' : '❌ Cryptographic Verification Failed (Tamper Caught!)'}</strong>
        <div style="font-size: 10px; margin-top: 4px; opacity: 0.9;">Verified in ${duration} ms via native WebCrypto subtle.verify</div>
        <div style="margin-top: 4px;">
          ${results.map(r => `<div>${r.valid ? '✓' : '✗'} ${escapeHtml(r.name)} (${escapeHtml(r.kid)}): ${r.valid ? 'VALID' : (tamper ? 'SIGNATURE MISMATCH (TAMPER DETECTED)' : escapeHtml(r.error || 'INVALID'))}</div>`).join("")}
        </div>
      </div>
    `;
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
          <h4>${escapeHtml(d.trip_title)}</h4>
          <div>Direct Total: $${Number(d.total_cost_usd || 0).toFixed(2)} USD</div>
          <div>Direct Savings: $${Number(d.direct_savings_usd || 0).toFixed(2)} USD</div>
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

  static initTelemetry() {
    const statsEl = document.querySelector("#telemetry-stats");
    if (!statsEl) return;

    let manifestsCount = 3;
    let bridgesCount = 2;
    let tokensEstimate = 0;

    const updatePill = () => {
      const estOtariCost = tokensEstimate > 0 ? (tokensEstimate * 0.0000004).toFixed(5) : "0.0006";
      statsEl.textContent = `${manifestsCount} CORS manifests verified • ${bridgesCount} MessageChannel bridges • Host LLM bill: $0.00 • Visitor Otari inference: ~$${estOtariCost}`;
    };

    updatePill();

    const hookTrace = () => {
      const trace = window.__nsweb?.trace;
      if (!trace) return false;

      trace.addEventListener("event", (e) => {
        const ev = e.detail;
        if (!ev) return;
        if (ev.kind === "fetch" || ev.phase === "remote_fetch") manifestsCount++;
        if (ev.kind === "action_catalog" || ev.kind === "bridge") bridgesCount++;
        if (ev.tokens || ev.usage?.total_tokens) tokensEstimate += (ev.tokens || ev.usage.total_tokens);
        updatePill();
      });
      return true;
    };

    if (!hookTrace()) {
      const interval = setInterval(() => {
        if (hookTrace()) clearInterval(interval);
      }, 500);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }
}

if (typeof window !== "undefined") {
  window.TripStewardApp = TripStewardApp;
  document.addEventListener("DOMContentLoaded", () => {
    TripStewardApp.init();
  });
}
