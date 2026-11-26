# DEV-002: Production VM Deployment & Reverse Proxy Architecture

---
id: "DEV-002"
type: "development"
title: "Production VM Deployment & Reverse Proxy Architecture"
domain: "development"
status: "APPROVED"
version: "1.2.0"
---

## Rule
TripSteward / CuraPilot is deployed on the production VM without disturbing any pre-existing workloads (such as Holy Bible FastAPI on port 8000 or OpenHands Gateway on port 8080/8443):

1. **Local Node Background Services**:
   - Managed via systemd service `curapilot.service`.
   - Runs `node scripts/serve_vm.mjs` under the `ubuntu` system user.
   - Binds the 3 static Open Agentic Web sites to loopback-only ports:
     - `127.0.0.1:8880`: `sites/tripsteward-hub` (Hub & Chief Concierge)
     - `127.0.0.1:8881`: `sites/cityglide-node` (CityGlide Transfers Node)
     - `127.0.0.1:8882`: `sites/metropass-node` (MetroPass Experiences Node)
2. **Nginx Reverse Proxy & Multi-Domain SSL Integration**:
   - Uses `/etc/nginx/snippets/curapilot.conf` included inside `/etc/nginx/sites-available/default`.
   - Dedicated server blocks:
     - `server_name pnrs.is-a.dev`: Serves FastAPI Holy Bible at root `/`, and proxies `/tripsteward/`, `/rides/`, and `/experiences/` to the local federated nodes.
     - `server_name elroi.js.org`: Custom JS.ORG domain dedicated to this app. Automatically redirects root `/` (301) to `/tripsteward/`, and serves all federated agent nodes (`/tripsteward/`, `/rides/`, `/experiences/`).
     - Port 80 HTTP server block cleanly redirects (301) all traffic for both `pnrs.is-a.dev` and `elroi.js.org` to `https://$host$request_uri`.
   - Enforces `proxy_hide_header Access-Control-Allow-Origin;` before `add_header Access-Control-Allow-Origin * always;` across all proxied locations to guarantee modern browsers receive exactly one CORS header without duplicates.
   - Static server runners (`scripts/serve_site.mjs`) include `/.well-known/agent.json` in `publicPaths()` alongside `agent-manifest.json` and `links.json` for A2A compatibility.
3. **JS.ORG Subdomain Registry & CNAME Verification**:
   - Root-level `CNAME` file containing `elroi.js.org` tracked in version control for domain ownership verification.
   - Registered via Pull Request on `js-org/js.org` (PR #13046) mapping `"elroi": "pnrs.is-a.dev"`.

## Do
- Use loopback bindings (`127.0.0.1`) for local node servers.
- Ensure all static and declarative agent artifacts return `Access-Control-Allow-Origin: *`.
- Route domain-specific roots (such as `elroi.js.org` -> `/tripsteward/`) using isolated server blocks so root workloads on other domains remain undisturbed.
- Maintain systemd auto-restart (`Restart=always`, `RestartSec=5`) for persistent uptime.

## Dont
- Do NOT alter or kill existing processes (`holybible`, `openhands`, `ollama`).
- Do NOT expose unauthenticated internal HTTP ports directly to public interfaces.
- Do NOT modify root `/` location block on `pnrs.is-a.dev` which serves existing applications.

## Reason
Running the agent cluster via a dedicated systemd service proxied through isolated Nginx server blocks guarantees 100% isolation, preventing interference with other production services while providing public SSL/HTTPS access for both the primary VM host and custom JS.ORG subdomains.

## Related Items
- `knowledge/index.yaml`
- `ARCH-002`: TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture
- `DEV-001`: In-Browser Runtime, Site Actions & Otari BYOK Standards
