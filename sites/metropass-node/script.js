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

function generateQRCodeSVG(code, size = 72) {
  const matrix = Array.from({ length: 21 }, () => Array(21).fill(0));
  function drawFinder(r, c) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          matrix[r + i][c + j] = 1;
        }
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, 14);
  drawFinder(14, 0);

  for (let i = 8; i < 13; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) - hash) + code.charCodeAt(i);
    hash |= 0;
  }

  let bitIdx = 0;
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= 13;
      const inBL = r >= 13 && c < 8;
      const inTiming = r === 6 || c === 6;
      if (inTL || inTR || inBL || inTiming) continue;
      const pseudoBit = ((hash >> (bitIdx % 31)) ^ (r * 7 + c * 13)) & 1;
      matrix[r][c] = pseudoBit;
      bitIdx++;
    }
  }

  const cellSize = size / 21;
  let rects = "";
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      if (matrix[r][c] === 1) {
        rects += `<rect x="${(c * cellSize).toFixed(1)}" y="${(r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="#0f172a" />`;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="border-radius: 6px; background: #ffffff; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><rect width="${size}" height="${size}" fill="#ffffff"/>${rects}</svg>`;
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

    bookPass(args) {
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

      this.bookings.unshift(booking);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("oaw_metropass_bookings", JSON.stringify(this.bookings));
        }
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel("oaw_provider_events");
          ch.postMessage({ type: "metropass_pass_booked", booking });
          ch.close();
        }
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
        <div class="exp-footer">
          <div class="exp-price">$${escapeHtml(String(exp.price_usd))} <span>/ person</span></div>
          <button class="btn-sm btn-amber" onclick="MetroPassApp.bookManual('${escapeHtml(exp.id)}')">Book 2 Passes</button>
        </div>
      </div>
    `).join("");
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

  static bookManual(expId) {
    MetroPassApp.vault.bookPass({
      experience_id: expId,
      attendee_name: "Walk-in Guest",
      tickets: 2
    });
    alert(`Pass Issued! Check Confirmed Passes below.`);
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
