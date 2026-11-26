# DEV-002: Production VM Deployment & Reverse Proxy Architecture

---
id: "DEV-002"
type: "development"
title: "Production VM Deployment & Reverse Proxy Architecture"
domain: "development"
status: "APPROVED"
version: "1.3.0"
---

## Rule
TripSteward is deployed on the production VM without disturbing any pre-existing workloads (such as Holy Bible FastAPI on port 8000 or OpenHands Gateway on port 8080/8443):

1. **Local Node Background Services**:
   - Managed via systemd service `tripsteward.service`.
   - Runs `node scripts/serve_vm.mjs` under the `ubuntu` system user.
   - Binds the 7 static Open Agentic Web sites to loopback-only ports:
     - `127.0.0.1:8880`: `sites/tripsteward-hub` (Hub & Chief Concierge)
     - `127.0.0.1:8881`: `sites/cityglide-node` (CityGlide Transfers Node)
     - `127.0.0.1:8882`: `sites/metropass-node` (MetroPass Experiences Node)
     - `127.0.0.1:8883`: `sites/tablebespoke-node` (TableBespoke Dining Node)
     - `127.0.0.1:8884`: `sites/alpinetrail-node` (AlpineTrail Expeditions Node)
     - `127.0.0.1:8885`: `sites/luggagefly-node` (LuggageFly Logistics Node)
     - `127.0.0.1:8886`: `sites/travelshield-node` (TravelShield Protection Node)
2. **Nginx Reverse Proxy & Subpath SSL Integration**:
   - Uses `/etc/nginx/snippets/curapilot.conf` included inside `/etc/nginx/sites-available/default`.
   - Host `server_name pnrs.is-a.dev`: Serves FastAPI Holy Bible at root `/` (port 8000), and proxies `/tripsteward/`, `/rides/`, `/experiences/`, `/dining/`, `/alpine/`, `/luggage/`, and `/insurance/` to the local federated nodes.
   - Port 80 HTTP server block cleanly redirects (301) all traffic for `pnrs.is-a.dev` to `https://$host$request_uri`.
   - Enforces `proxy_hide_header Access-Control-Allow-Origin;` before `add_header Access-Control-Allow-Origin * always;` across all proxied locations to guarantee modern browsers receive exactly one CORS header without duplicates.
   - Static server runners (`scripts/serve_site.mjs`) include `/.well-known/agent.json` and `/.well-known/jwks.json` in `publicPaths()` alongside `agent-manifest.json` and `links.json` for A2A and cryptographic non-repudiation compatibility.

## Do
- Use loopback bindings (`127.0.0.1`) for local node servers.
- Ensure all static and declarative agent artifacts return `Access-Control-Allow-Origin: *`.
- Route federated agent nodes cleanly using dedicated subpaths (`/tripsteward/`, `/rides/`, `/experiences/`, etc.) so root workloads on port 8000 remain undisturbed.
- Maintain systemd auto-restart (`Restart=always`, `RestartSec=5`) for persistent uptime.

## Dont
- Do NOT alter or kill existing processes (`holybible`, `openhands`, `ollama`).
- Do NOT expose unauthenticated internal HTTP ports directly to public interfaces.
- Do NOT modify root `/` location block on `pnrs.is-a.dev` which serves existing applications.

## Reason
Running the agent cluster via a dedicated systemd service proxied through subpath reverse proxy blocks guarantees 100% isolation, preventing interference with other production services while providing public SSL/HTTPS access across all federated agent nodes.

## Related Items
- `knowledge/index.yaml`
- `ARCH-002`: TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture
- `DEV-001`: In-Browser Runtime, Site Actions & Otari BYOK Standards
