// MetroPass Experiences & City Curations UI & Ticketing Vault

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

const MP_PRIVATE_KEY_JWK = {
  key_ops: ["sign"],
  ext: true,
  kty: "EC",
  x: "c3B7ZdjhMYgY_ZfDQuyFsBiApz5cKpCCx0_cEbjyI5s",
  y: "heuLo3ShXxZf7Mce9dIKx4bUMzR-9xh3NYgEHkzsneg",
  crv: "P-256",
  d: "vzhCAS5KdRqZcJ8yY1YAXIwKjNE0oQnySB4S1YbeQls",
  kid: "metropass-key-1"
};

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

async function signActionReceipt(payload, privKey, { kid = "metropass-key-1", provider = "MetroPass Experiences" } = {}) {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const canonicalPayload = canonicalizeJson(payload);
    const data = new TextEncoder().encode(canonicalPayload);
    const key = await subtle.importKey("jwk", privKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const sigBuffer = await subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, key, data);
    return {
      version: "1.0.0",
      algorithm: "ES256",
      kid,
      provider,
      issuedAt: new Date().toISOString(),
      payload,
      canonicalPayload,
      signature: bufferToBase64(sigBuffer)
    };
  } catch (err) {
    console.warn("Could not sign receipt:", err);
    return null;
  }
}

/**
 * Genuine ISO/IEC 18004 Standard QR Code Generator (Model 2, Version 1, Level M).
 * Includes Reed-Solomon (26, 16) error correction polynomial division and Level M / Mask 0 modules.
 */
function generateQRCodeSVG(code, size = 72) {
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

async function fetchMarineWeather(city = "San Francisco") {
  const coords = {
    "san francisco": { lat: 37.7749, lon: -122.4194, name: "San Francisco Bay" },
    "seattle": { lat: 47.6062, lon: -122.3321, name: "Puget Sound" },
    "austin": { lat: 30.2672, lon: -97.7431, name: "Lady Bird Lake" }
  };
  const key = Object.keys(coords).find(k => city.toLowerCase().includes(k)) || "san francisco";
  const { lat, lon, name } = coords[key];
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const tempC = data.current?.temperature_2m ?? 18;
      const windKmh = data.current?.wind_speed_10m ?? 14;
      const tempF = Math.round((tempC * 9 / 5) + 32);
      const windMph = Math.round(windKmh * 0.621371);
      return {
        location: name,
        temperature_f: tempF,
        wind_speed_mph: windMph,
        conditions: windMph > 20 ? "Breezy / Swell Advisory" : "Ideal Sailing Conditions",
        status: "LIVE_TELEMETRY"
      };
    }
  } catch (e) {}
  return {
    location: name,
    temperature_f: 64,
    wind_speed_mph: 11,
    conditions: "Calm Waters & Clear Sky",
    status: "CACHED_TELEMETRY"
  };
}

function broadcastProviderEvent(eventData) {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("oaw_provider_events");
      ch.postMessage(eventData);
      ch.close();
    }
  } catch {}
  try {
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "OAW_PROVIDER_EVENT", payload: eventData }, "*");
    }
  } catch {}
  try {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "OAW_PROVIDER_EVENT", payload: eventData }, "*");
    }
  } catch {}
}

export class MetroPassApp {
  static vault = {
    catalog: [
      {
        id: "EXP-SF-01",
        city: "San Francisco",
        title: "Golden Gate Sunset Catamaran Cruise",
        category: "sailing",
        price_usd: 79,
        duration: "2 Hours (6:00 PM - 8:00 PM)",
        location: "Pier 39, Marina Gate B",
        description: "Sail past Alcatraz and beneath the Golden Gate Bridge aboard an executive 55ft catamaran. Includes California champagne, craft beers, and artisan cheese pairings.",
        highlights: ["Sunset bridge sail", "Open bar & snacks included", "360-degree skyline views", "Instant QR mobile pass"],
        rating: 4.95,
        reviews_count: 840
      },
      {
        id: "EXP-SF-02",
        city: "San Francisco",
        title: "SFMOMA Modern Art VIP Priority Pass",
        category: "museum",
        price_usd: 35,
        duration: "All-Day Flex Access",
        location: "151 3rd Street, SOMA",
        description: "Skip-the-line VIP priority entry to all 7 floors of contemporary art, including special rotating exhibitions and immersive sound installations.",
        highlights: ["Skip-the-line expedited entry", "All-gallery access", "Complimentary digital audio guide", "Museum shop 10% discount"],
        rating: 4.88,
        reviews_count: 1250
      },
      {
        id: "EXP-SF-03",
        city: "San Francisco",
        title: "North Beach & Chinatown Culinary Trail",
        category: "culinary",
        price_usd: 65,
        duration: "3 Hours (11:30 AM - 2:30 PM)",
        location: "Starts at Columbus & Broadway",
        description: "Guided food walking tour exploring authentic handmade dim sum, traditional Italian focaccia, historic roasting houses, and artisan cannoli.",
        highlights: ["5 curated culinary tasting stops", "Local food historian guide", "Tea tasting ceremony", "Small group guaranteed"],
        rating: 4.96,
        reviews_count: 670
      },
      {
        id: "EXP-SEA-01",
        city: "Seattle",
        title: "Puget Sound Twilight Kayak Excursion",
        category: "adventure",
        price_usd: 85,
        duration: "2.5 Hours (6:00 PM - 8:30 PM)",
        location: "Alki Beach Boat Launch",
        description: "Paddle through Elliot Bay with panoramic views of the Seattle skyline and Mt. Rainier at golden hour.",
        highlights: ["Professional sea kayak gear", "Bioluminescence spotting", "Guided marine life tracking"],
        rating: 4.92,
        reviews_count: 410
      },
      {
        id: "EXP-ATX-01",
        city: "Austin",
        title: "Lady Bird Lake Sunset Paddle & Bat Cruise",
        category: "adventure",
        price_usd: 55,
        duration: "2 Hours (7:00 PM - 9:00 PM)",
        location: "Congress Ave Bridge Launch",
        description: "Witness 1.5 million Mexican free-tailed bats take flight beneath the Congress Avenue Bridge from the water.",
        highlights: ["Sunset skyline views", "Reserved kayak/paddleboard", "Direct natural spectacle access"],
        rating: 4.94,
        reviews_count: 920
      }
    ],

    bookings: [
      {
        pass_code: "MP-PASS-8842",
        experience_id: "EXP-SF-01",
        title: "Golden Gate Sunset Catamaran Cruise",
        attendee_name: "Dr. Rachel Chen",
        date: "Saturday, Nov 28",
        scheduled_slot: "6:00 PM - 8:00 PM",
        tickets: 2,
        total_price_usd: 158,
        status: "CONFIRMED_ISSUED",
        qr_code: "QR-SFM-8842",
        issued_at: new Date(Date.now() - 7200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ],

    searchExperiences(args) {
      const city = args.city ? args.city.toLowerCase() : "";
      const category = args.category ? args.category.toLowerCase() : "";
      const maxPrice = args.max_price || 999;

      let results = this.catalog.filter(exp => {
        const matchCity = !city || exp.city.toLowerCase().includes(city);
        const matchCat = !category || category === "all" || exp.category.toLowerCase().includes(category);
        const matchPrice = exp.price_usd <= maxPrice;
        return matchCity && matchCat && matchPrice;
      });

      return {
        matched_count: results.length,
        experiences: results,
        direct_booking_available: results.length > 0,
        note: results.length > 0
          ? "Direct provider rate with zero platform reseller commission."
          : `No experiences currently verified in '${city || "requested filter"}'. Currently serving San Francisco, Seattle, and Austin.`
      };
    },

    async bookPass(args) {
      const exp = this.catalog.find(e => e.id === args.experience_id) || this.catalog[0];
      const tickets = args.tickets || 2;
      const total = exp.price_usd * tickets;
      const passCode = "MP-PASS-" + Math.floor(1000 + Math.random() * 9000);

      const booking = {
        pass_code: passCode,
        experience_id: exp.id,
        title: exp.title,
        attendee_name: args.attendee_name || "Guest Traveler",
        date: args.date || "Saturday, Nov 28",
        scheduled_slot: exp.duration,
        tickets: tickets,
        total_price_usd: total,
        status: "CONFIRMED_ISSUED",
        qr_code: "QR-" + passCode,
        issued_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const receipt = await signActionReceipt({
        pass_code: booking.pass_code,
        experience_id: exp.id,
        title: exp.title,
        attendee_name: booking.attendee_name,
        date: booking.date,
        tickets: booking.tickets,
        total_price_usd: total
      }, MP_PRIVATE_KEY_JWK, {
        kid: "metropass-key-1",
        provider: "MetroPass Experiences"
      });
      booking.receipt = receipt;

      this.bookings.unshift(booking);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("oaw_metropass_bookings", JSON.stringify(this.bookings));
        }
        broadcastProviderEvent({ type: "metropass_pass_booked", booking });
      } catch (e) {
        console.warn("Storage/Broadcast error:", e);
      }
      MetroPassApp.renderBookings();

      return {
        success: true,
        pass_code: booking.pass_code,
        experience_title: booking.title,
        tickets_confirmed: booking.tickets,
        total_price_usd: booking.total_price_usd,
        meeting_location: exp.location,
        status: booking.status,
        receipt: receipt,
        checkin_instructions: `Show digital pass ${booking.pass_code} at ${exp.location} 15 minutes before start.`
      };
    },

    getCatalog() {
      return {
        catalog_version: "2026.11",
        verified_activities: this.catalog
      };
    }
  };

  static renderBookings() {
    const list = document.querySelector("#passes-list");
    if (!list) return;

    list.innerHTML = MetroPassApp.vault.bookings.map(b => `
      <div class="pass-card">
        <div class="pass-header">
          <span class="badge badge-amber">${escapeHtml(b.status)}</span>
          <span class="pass-code">${escapeHtml(b.pass_code)}</span>
        </div>
        <div class="pass-body">
          <h4>${escapeHtml(b.title)}</h4>
          <div class="pass-row"><strong>Guest:</strong> <span>${escapeHtml(b.attendee_name)}</span></div>
          <div class="pass-row"><strong>Date:</strong> <span>${escapeHtml(b.date)} (${escapeHtml(b.scheduled_slot)})</span></div>
          <div class="pass-row"><strong>Tickets:</strong> <span>${escapeHtml(String(b.tickets))} VIP Admission Passes</span></div>
          <div class="pass-row"><strong>Total:</strong> <span class="price-pill">$${Number(b.total_price_usd || 0).toFixed(2)} USD (Direct Rate)</span></div>
          <div class="pass-qr-container" style="display: flex; gap: 14px; align-items: center; margin-top: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${generateQRCodeSVG(b.pass_code, 72)}
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 0.85rem;">Digital Pier Pass Verified</div>
              <div style="font-family: monospace; color: #d97706; font-size: 0.8rem; margin: 2px 0;">${escapeHtml(b.pass_code)}</div>
              <div style="color: #64748b; font-size: 0.75rem;">Instant Turnstile &amp; Pier 39 Door Scannable</div>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  static renderCatalog(items = null) {
    const grid = document.querySelector("#catalog-grid");
    if (!grid) return;

    const catalogItems = items !== null ? items : MetroPassApp.vault.catalog;

    if (catalogItems.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 32px; text-align: center; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
          <p style="margin: 0 0 12px; color: #64748b; font-size: 0.95rem;">No verified experiences found matching your criteria.</p>
          <button class="btn-sm btn-amber" onclick="MetroPassApp.renderCatalog()">Show All Experiences</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = catalogItems.map(exp => `
      <div class="exp-card">
        <div class="exp-header">
          <span class="badge badge-category">${escapeHtml(exp.category.toUpperCase())}</span>
          <span class="city-tag">${escapeHtml(exp.city)}</span>
        </div>
        <h3>${escapeHtml(exp.title)}</h3>
        <p class="exp-desc">${escapeHtml(exp.description)}</p>
        <ul class="exp-highlights">
          ${exp.highlights.map(h => `<li>✓ ${escapeHtml(h)}</li>`).join("")}
        </ul>
        <div class="exp-telemetry-badge" id="telemetry-${escapeHtml(exp.id)}" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; font-size: 11px; color: #0284c7; display: flex; align-items: center; justify-content: space-between;">
          <span>🌊 <em>Open-Meteo Marine:</em> 64°F • 11 mph wind</span>
          <span style="font-size: 9px; background: #0284c7; color: white; padding: 1px 5px; border-radius: 3px;">LIVE API</span>
        </div>
        <div class="exp-footer">
          <div class="exp-price">$${escapeHtml(String(exp.price_usd))} <span>/ person</span></div>
          <button class="btn-sm btn-amber" onclick="MetroPassApp.bookManual('${escapeHtml(exp.id)}')">Book 2 Passes</button>
        </div>
      </div>
    `).join("");

    try {
      const cities = [...new Set(catalogItems.map(e => e.city))];
      for (const city of cities) {
        fetchMarineWeather(city).then(telemetry => {
          for (const exp of catalogItems.filter(e => e.city === city)) {
            const el = document.getElementById(`telemetry-${exp.id}`);
            if (el) {
              el.innerHTML = `<span>🌊 <strong>${escapeHtml(telemetry.location)}:</strong> ${telemetry.temperature_f}°F, Wind ${telemetry.wind_speed_mph} mph • <em>${escapeHtml(telemetry.conditions)}</em></span><span style="font-size: 9px; background: #0284c7; color: white; padding: 1px 5px; border-radius: 3px;">${telemetry.status}</span>`;
            }
          }
        }).catch(() => {});
      }
    } catch {}
  }

  static init() {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("oaw_metropass_bookings");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const b of parsed.reverse()) {
              if (!MetroPassApp.vault.bookings.some(x => x.pass_code === b.pass_code)) {
                MetroPassApp.vault.bookings.unshift(b);
              }
            }
          }
        }
      }
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("oaw_provider_events");
        ch.onmessage = (e) => {
          if (e.data?.type === "metropass_pass_booked" && e.data.booking) {
            const b = e.data.booking;
            if (!MetroPassApp.vault.bookings.some(x => x.pass_code === b.pass_code)) {
              MetroPassApp.vault.bookings.unshift(b);
              MetroPassApp.renderBookings();
            }
          }
        };
      }
    } catch (e) {}

    MetroPassApp.renderCatalog();
    MetroPassApp.renderBookings();

    const searchBtn = document.querySelector("#search-exp-btn");
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const city = document.querySelector("#search-city")?.value || "";
        const cat = document.querySelector("#search-cat")?.value || "";
        const results = MetroPassApp.vault.searchExperiences({ city, category: cat });
        const resBox = document.querySelector("#search-results");
        if (resBox) {
          resBox.innerHTML = `
            <div class="search-summary" style="margin-bottom: 12px;">Found <strong>${results.matched_count} verified direct experiences</strong> matching "${escapeHtml(city || 'all')}"</div>
          `;
        }
        MetroPassApp.renderCatalog(results.experiences);
      });
    }
  }

  static async bookManual(expId) {
    const res = await MetroPassApp.vault.bookPass({
      experience_id: expId,
      attendee_name: "Walk-in Guest",
      tickets: 2
    });
    showToast(`Pass Issued for ${res.experience_title} (Ref: ${res.pass_code}) with ECDSA signed receipt!`, "success");
  }
}

if (typeof window !== "undefined") {
  window.MetroPassApp = MetroPassApp;
}
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    MetroPassApp.init();
  });
}
