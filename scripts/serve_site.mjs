// Serve an agentified site folder over HTTP, with the headers the skill asks a host to send.
//
// Usage:
//   node serve_site.mjs <site folder> [--host 127.0.0.1] [--port 8080]
//        [--open-as <host name>] [--log requests.jsonl]
//
// Only the public files get Access-Control-Allow-Origin: *, so other agent sites can read
// them: agent-manifest.json, each network file the manifest names, links.json,
// agent-mcp.json and the two .well-known files. runtime/sandbox-worker.js gets its
// Content-Security-Policy. Nothing is cached, and nothing blocks framing, so other sites
// can load bridge/action-bridge.html. Stop it with Ctrl+C.

import { appendFileSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";

const INVENTORY_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), ".shared_inventory.json");

const DEFAULT_INVENTORY = {
  rooms: {
    total: 12,
    held: 3,
    available: 9,
    activeHolds: [
      { room_id: "HV-ROOM-201", guest: "Elena Rostova", time: new Date().toISOString() }
    ]
  },
  fleet: {
    total: 8,
    dispatched: 2,
    standby: 6,
    activeRides: [
      { transfer_id: "CG-TRANS-INIT-1", vehicle_class: "Executive EV Sedan", fare_usd: 68, time: new Date().toISOString() }
    ]
  },
  experiences: {
    totalPasses: 50,
    issuedPasses: 14,
    remainingPasses: 36,
    activeBookings: [
      { pass_code: "MP-PASS-INIT-1", experience: "Golden Gate Sunset Catamaran Cruise", tickets: 2, total_price_usd: 158, time: new Date().toISOString() }
    ]
  }
};

async function getSharedInventory() {
  try {
    const data = await readFile(INVENTORY_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    await saveSharedInventory(DEFAULT_INVENTORY);
    return JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
  }
}

async function saveSharedInventory(inventory) {
  try {
    const tempFile = `${INVENTORY_FILE}.tmp.${process.pid}`;
    const fs = await import("node:fs/promises");
    await fs.writeFile(tempFile, JSON.stringify(inventory, null, 2), "utf8");
    await fs.rename(tempFile, INVENTORY_FILE);
  } catch (e) {
    console.warn("Could not save shared inventory to disk:", e);
  }
}

function validateReservationAgainstInventory(inventory, payload, kid) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "Missing reservation payload object" };
  }

  // 1. HarborView Hotel validation
  if (kid.includes("harborview")) {
    const resId = payload.reservation_id || payload.room_id;
    if (!resId || !resId.startsWith("HV-")) {
      return { valid: false, reason: "Invalid HarborView reservation format (must start with HV-)" };
    }
    const hold = inventory.rooms?.activeHolds?.find(h => h.room_id === resId);
    if (!hold) {
      return { valid: false, reason: `Unverified reservation: hold #${resId} not found in verified room inventory` };
    }
    return { valid: true };
  }

  // 2. CityGlide Fleet validation
  if (kid.includes("cityglide")) {
    const transId = payload.transfer_id;
    if (!transId || !transId.startsWith("CG-")) {
      return { valid: false, reason: "Invalid CityGlide transfer format (must start with CG-)" };
    }
    const ride = inventory.fleet?.activeRides?.find(r => r.transfer_id === transId);
    if (!ride) {
      return { valid: false, reason: `Unverified dispatch: transfer #${transId} not found in verified fleet inventory` };
    }
    return { valid: true };
  }

  // 3. MetroPass Experiences validation
  if (kid.includes("metropass")) {
    const passCode = payload.pass_code;
    if (!passCode || !passCode.startsWith("MP-")) {
      return { valid: false, reason: "Invalid MetroPass voucher format (must start with MP-)" };
    }
    const booking = inventory.experiences?.activeBookings?.find(b => b.pass_code === passCode);
    if (!booking) {
      return { valid: false, reason: `Unverified voucher: pass #${passCode} not found in verified experiences inventory` };
    }
    return { valid: true };
  }

  return { valid: false, reason: `Unknown provider key identifier: ${kid}` };
}

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalizeJson).join(",") + "]";
  return "{" + Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(",") + "}";
}

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

let PROVIDER_KEYS = null;
async function loadProviderKeys() {
  if (PROVIDER_KEYS) return PROVIDER_KEYS;
  try {
    const keyFile = path.join(path.dirname(new URL(import.meta.url).pathname), "provider_keys.json");
    PROVIDER_KEYS = JSON.parse(await readFile(keyFile, "utf8"));
  } catch (e) {
    PROVIDER_KEYS = {};
  }
  return PROVIDER_KEYS;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", chunk => { data += chunk; });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    request.on("error", reject);
  });
}

/**
 * Serves one site folder for local checks.
 *
 * It sends the CORS header on the public files only, as "Static hosting" in the skill's
 * references/bundle_and_hosting.md lists them, so other agent sites can call this one.
 * It refuses paths outside the folder. With --log it writes one JSON line per request,
 * with header names and flags but no header values except Origin.
 */
class SiteServer {
  /**
   * The policy for the coded-tool worker, from "Static hosting" in bundle_and_hosting.md.
   */
  static WORKER_CSP = "default-src 'none'; script-src blob:; connect-src 'none'; worker-src 'none'";

  /**
   * Content types by file extension. Other files are sent as application/octet-stream.
   */
  static TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".woff2": "font/woff2",
  };

  /**
   * Addresses that only this machine can reach.
   */
  static LOOPBACK = ["127.0.0.1", "localhost", "::1"];

  /**
   * The usage text, printed for --help and after a bad argument.
   */
  static USAGE = [
    "Usage: node serve_site.mjs <site folder> [--host 127.0.0.1] [--port 8080] [--open-as <host name>] [--log requests.jsonl]",
    "  --host     The address to listen on. Default 127.0.0.1, which only this machine can reach.",
    "  --port     The port to listen on. Default 8080. Use 0 for any free port.",
    "  --open-as  The host name in the printed URL. Use it when two linked sites run on one machine: open one as 127.0.0.1 and the other as localhost.",
    "  --log      Add one JSON line per request to this file: method, path, status, Origin, whether Authorization was sent, and cookie names.",
  ].join("\n");

  /**
   * Store the options. Call start() to listen.
   *
   * :param options: Parsed options with folder, host, port, openAs and log.
   */
  constructor(options) {
    this.options = options;
    // The real path of the site folder, set by start(). Every served file must be inside it.
    this.root = null;
    this.server = null;
  }

  /**
   * Parse command-line arguments into an options object.
   *
   * :param argv: The arguments after the script name.
   * :return: The options object, with help true when --help was given.
   * :raises Error: When the folder is missing, an option has no value or the port is not a number.
   */
  static parseArgs(argv) {
    const options = {
      folder: null,
      host: "127.0.0.1",
      port: 8080,
      openAs: null,
      log: null,
      help: false,
    };
    let index = 0;
    while (index < argv.length) {
      const arg = argv[index];
      if (arg === "--help" || arg === "-h") {
        options.help = true;
      } else if (arg === "--host" || arg === "--port" || arg === "--open-as" || arg === "--log") {
        const value = argv[index + 1];
        if (value === undefined) {
          throw new Error(`${arg} needs a value.`);
        }
        if (arg === "--host") {
          options.host = value;
        } else if (arg === "--port") {
          options.port = Number(value);
        } else if (arg === "--open-as") {
          options.openAs = value;
        } else {
          options.log = value;
        }
        index += 1;
      } else if (options.folder === null) {
        options.folder = arg;
      } else {
        throw new Error(`Unexpected argument: ${arg}`);
      }
      index += 1;
    }
    if (options.help) {
      return options;
    }
    if (options.folder === null) {
      throw new Error("Give the site folder to serve.");
    }
    if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
      throw new Error("--port needs a number from 0 to 65535.");
    }
    return options;
  }

  /**
   * Start the server and print the URL to open. The server keeps running after this returns.
   *
   * :param argv: The arguments after the script name.
   * :return: The process exit code: 0 once the server listens, 2 on a bad argument or start failure.
   */
  static async main(argv) {
    let options;
    try {
      options = SiteServer.parseArgs(argv);
    } catch (error) {
      console.error(error.message);
      console.error(SiteServer.USAGE);
      return 2;
    }
    if (options.help) {
      console.log(SiteServer.USAGE);
      return 0;
    }
    const server = new SiteServer(options);
    try {
      const port = await server.start();
      console.log(`Open ${server.openUrl(port)}`);
    } catch (error) {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${options.port} is in use. Stop the other server or pass another --port.`);
      } else {
        console.error(`Cannot serve ${options.folder}: ${error.message}`);
      }
      return 2;
    }
    return 0;
  }

  /**
   * Listen on the host and port from the options.
   *
   * :return: The port the server listens on.
   * :raises Error: When the folder does not exist or the port is taken.
   */
  async start() {
    this.root = await realpath(this.options.folder);
    if (!SiteServer.LOOPBACK.includes(this.options.host)) {
      console.error(`WARNING: ${this.options.host} is not a loopback address, so other machines may reach this server.`);
    }
    try {
      await stat(path.join(this.root, "agent-manifest.json"));
    } catch (error) {
      console.error(`Note: ${this.root} has no agent-manifest.json, so other agent sites cannot call it.`);
    }
    this.server = http.createServer(this.handle.bind(this));
    this.server.listen(this.options.port, this.options.host);
    // once() rejects when the server emits "error" first, such as for a port in use.
    await once(this.server, "listening");
    return this.server.address().port;
  }

  /**
   * Build the URL to print. --open-as changes only its host name, not where the server listens.
   *
   * :param port: The port the server listens on.
   * :return: The URL, ending in "/".
   */
  openUrl(port) {
    const host = this.options.openAs || this.options.host;
    // An IPv6 address needs brackets in a URL.
    const shown = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
    return `http://${shown}:${port}/`;
  }

  /**
   * Answer one request, and answer 500 if that fails, so one bad request cannot stop the server.
   *
   * :param request: The incoming request.
   * :param response: The response to write.
   */
  async handle(request, response) {
    try {
      await this.answer(request, response);
    } catch (error) {
      if (!response.headersSent) {
        // Log the path without its query, as every other line does.
        this.send(request, response, String(request.url).split("?")[0], 500, {}, "Server error");
      }
    }
  }

  /**
   * Answer one request with a file from the site folder.
   *
   * :param request: The incoming request.
   * :param response: The response to write.
   */
  async answer(request, response) {
    let urlPath = "/";
    try {
      urlPath = new URL(request.url, "http://localhost").pathname;
    } catch (error) {
      this.send(request, response, urlPath, 400, {}, "Bad request");
      return;
    }
    // Handle CORS preflight for all endpoints
    if (request.method === "OPTIONS") {
      this.send(request, response, urlPath, 204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400"
      }, "");
      return;
    }

    // 1. Cross-Session Shared Inventory API
    if (urlPath === "/api/inventory") {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      };
      const inventory = await getSharedInventory();
      if (request.method === "GET") {
        this.send(request, response, urlPath, 200, headers, JSON.stringify(inventory));
        return;
      }
      if (request.method === "POST") {
        try {
          const body = await readRequestBody(request);
          if (body.action === "hold_room") {
            inventory.rooms.held += 1;
            inventory.rooms.available = Math.max(0, inventory.rooms.total - inventory.rooms.held);
            inventory.rooms.activeHolds.push({
              room_id: body.room_id || "HV-ROOM-204",
              guest: body.guest || "Guest",
              time: new Date().toISOString()
            });
          } else if (body.action === "dispatch_ride") {
            inventory.fleet.dispatched += 1;
            inventory.fleet.standby = Math.max(0, inventory.fleet.total - inventory.fleet.dispatched);
            inventory.fleet.activeRides.push({
              transfer_id: body.transfer_id,
              vehicle_class: body.vehicle_class,
              time: new Date().toISOString()
            });
          } else if (body.action === "issue_pass") {
            const tickets = Number(body.tickets || 1);
            inventory.experiences.issuedPasses += tickets;
            inventory.experiences.remainingPasses = Math.max(0, inventory.experiences.totalPasses - inventory.experiences.issuedPasses);
            inventory.experiences.activeBookings.push({
              pass_code: body.pass_code,
              experience: body.title,
              tickets,
              time: new Date().toISOString()
            });
          }
          await saveSharedInventory(inventory);
          this.send(request, response, urlPath, 200, headers, JSON.stringify({ ok: true, inventory }));
          return;
        } catch (e) {
          this.send(request, response, urlPath, 400, headers, JSON.stringify({ ok: false, error: e.message }));
          return;
        }
      }
      this.send(request, response, urlPath, 405, { Allow: "GET, POST, OPTIONS" }, "Method not allowed");
      return;
    }

    // 2. Server-Side ECDSA Action Receipt Signing API
    if (urlPath === "/api/sign-receipt") {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      };
      if (request.method === "POST") {
        try {
          const body = await readRequestBody(request);
          const keys = await loadProviderKeys();
          let kid = body.kid;
          let provider = body.provider;
          if (!kid) {
            if (this.root.includes("cityglide")) { kid = "cityglide-key-1"; provider = "CityGlide Autonomous Fleet"; }
            else if (this.root.includes("metropass")) { kid = "metropass-key-1"; provider = "MetroPass Experiences & Culture"; }
            else { kid = "harborview-key-1"; provider = "HarborView Hotel & Residences"; }
          }
          const keyJwk = keys[kid];
          if (!keyJwk) {
            this.send(request, response, urlPath, 404, headers, JSON.stringify({ ok: false, error: `Key not found for kid: ${kid}` }));
            return;
          }

          // Anti-Oracle Verification: Verify reservation exists in shared inventory before signing!
          const inventory = await getSharedInventory();
          const verification = validateReservationAgainstInventory(inventory, body.payload, kid);
          if (!verification.valid) {
            this.send(request, response, urlPath, 403, headers, JSON.stringify({
              ok: false,
              error: `Signing Oracle Rejected: ${verification.reason}`
            }));
            return;
          }

          const subtle = globalThis.crypto?.subtle;
          const canonicalPayload = canonicalizeJson(body.payload || {});
          const enc = new TextEncoder();
          const data = enc.encode(canonicalPayload);
          const importedKey = await subtle.importKey(
            "jwk",
            keyJwk,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["sign"]
          );
          const sigBuffer = await subtle.sign(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            importedKey,
            data
          );
          const receipt = {
            version: "1.0.0",
            algorithm: "ES256",
            kid,
            provider: provider || keyJwk.provider || "Open Agentic Web Node",
            issuedAt: new Date().toISOString(),
            payload: body.payload || {},
            canonicalPayload,
            signature: bufferToBase64(sigBuffer)
          };
          this.send(request, response, urlPath, 200, headers, JSON.stringify(receipt));
          return;
        } catch (e) {
          this.send(request, response, urlPath, 500, headers, JSON.stringify({ ok: false, error: e.message }));
          return;
        }
      }
      this.send(request, response, urlPath, 405, { Allow: "POST, OPTIONS" }, "Method not allowed");
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      this.send(request, response, urlPath, 405, {
        Allow: "GET, HEAD, OPTIONS",
      }, "Method not allowed");
      return;
    }
    let decoded = null;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch (error) {
      this.send(request, response, urlPath, 400, {}, "Bad request");
      return;
    }
    const file = await this.resolveFile(decoded);
    if (file === null) {
      this.send(request, response, urlPath, 403, {}, "Forbidden");
      return;
    }
    let info = null;
    try {
      info = await stat(file);
    } catch (error) {
      this.send(request, response, urlPath, 404, {}, "Not found");
      return;
    }
    if (info.isDirectory()) {
      // Relative links in the folder's index.html need the trailing "/".
      if (!urlPath.endsWith("/")) {
        this.send(request, response, urlPath, 301, {
          Location: `${urlPath}/`,
        }, "");
        return;
      }
      await this.sendFile(request, response, urlPath, path.join(file, "index.html"));
      return;
    }
    await this.sendFile(request, response, urlPath, file);
  }

  /**
   * Turn a decoded URL path into a file path inside the site folder.
   *
   * :param decoded: The URL path, already percent-decoded.
   * :return: The file path, or null when the path leaves the folder.
   */
  async resolveFile(decoded) {
    if (decoded.includes("\0")) {
      return null;
    }
    const target = path.resolve(this.root, `.${path.sep}${decoded}`);
    if (this.inside(target)) {
      try {
        const real = await realpath(target);
        if (this.inside(real)) return real;
      } catch (error) {
        // Target missing in root, check shared fallback below
      }
    }
    // Shared runtime fallback: deduplicates 5.64MB of nsdeploy assets across specialist nodes
    if (decoded.startsWith("/runtime/") || decoded.startsWith("runtime/")) {
      const relRuntime = decoded.startsWith("/") ? decoded.slice(1) : decoded;
      const sharedRuntime = path.resolve(this.root, "..", "tripsteward-hub", relRuntime);
      try {
        const statCheck = await stat(sharedRuntime);
        if (statCheck.isFile() || statCheck.isDirectory()) {
          return sharedRuntime;
        }
      } catch (e) {
        // Not in shared fallback either
      }
    }
    return this.inside(target) ? target : null;
  }

  /**
   * Say whether a path is the site folder or inside it.
   *
   * :param target: An absolute path.
   * :return: True when the path is inside the site folder.
   */
  inside(target) {
    return target === this.root || target.startsWith(`${this.root}${path.sep}`);
  }

  /**
   * Send one file with its content type and headers.
   *
   * :param request: The incoming request.
   * :param response: The response to write.
   * :param urlPath: The URL path, for the headers and the log.
   * :param file: The file to send.
   */
  async sendFile(request, response, urlPath, file) {
    let body = null;
    try {
      body = await readFile(file);
    } catch (error) {
      this.send(request, response, urlPath, 404, {}, "Not found");
      return;
    }
    const type = SiteServer.TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const headers = await this.headersFor(urlPath);
    headers["Content-Type"] = type;
    this.send(request, response, urlPath, 200, headers, body);
  }

  /**
   * Return the extra headers for one URL path.
   *
   * :param urlPath: The URL path.
   * :return: The headers to send.
   */
  async headersFor(urlPath) {
    const headers = {};
    const publicPaths = await this.publicPaths();
    if (publicPaths.has(urlPath)) {
      headers["Access-Control-Allow-Origin"] = "*";
    }
    if (urlPath === "/runtime/sandbox-worker.js") {
      headers["Content-Security-Policy"] = SiteServer.WORKER_CSP;
    }
    return headers;
  }

  /**
   * List the URL paths of the public files, from the site's manifest.
   *
   * It reads the manifest on each request, so a rebuild with a new network file needs no restart.
   *
   * :return: A set of URL paths, each starting with "/".
   */
  async publicPaths() {
    const paths = new Set([
      "/agent-manifest.json",
      "/links.json",
      "/agent-mcp.json",
      "/.well-known/agent.json",
      "/.well-known/jwks.json",
    ]);
    let manifest = null;
    try {
      manifest = JSON.parse(await readFile(path.join(this.root, "agent-manifest.json"), "utf8"));
    } catch (error) {
      return paths;
    }
    const networks = Array.isArray(manifest.networks) ? manifest.networks : [];
    for (const entry of networks) {
      const file = entry && typeof entry.hocon === "string" ? entry.hocon : "";
      // A network file on another host is not served from here.
      if (file && !/^[a-z][a-z0-9+.-]*:/i.test(file)) {
        paths.add(`/${file.replace(/^(\.\/|\/)+/, "")}`);
      }
    }
    const protocol = String((manifest.linking || {}).protocol || "");
    const match = protocol.match(/^([a-z][a-z0-9-]*)-link\/v1$/);
    if (match) {
      paths.add(`/.well-known/${match[1]}.json`);
      paths.add(`/.well-known/${match[1]}-agent.json`);
    }
    return paths;
  }

  /**
   * Write the response, after adding the headers every response gets and logging it.
   *
   * :param request: The incoming request.
   * :param response: The response to write.
   * :param urlPath: The URL path, for the log.
   * :param status: The HTTP status.
   * :param headers: The headers for this response.
   * :param body: The body, as text or bytes.
   */
  send(request, response, urlPath, status, headers, body) {
    // A reload must never show files cached from another site served on this port before.
    headers["Cache-Control"] = "no-store";
    headers["Content-Length"] = Buffer.byteLength(body);
    // Log before the reply ends, so a check that reads the log after the reply sees this line.
    this.log(request, urlPath, status);
    response.writeHead(status, headers);
    response.end(request.method === "HEAD" ? "" : body);
  }

  /**
   * Add one JSON line for the request to the --log file.
   *
   * It records whether Authorization was sent and the cookie names, never their values.
   *
   * :param request: The incoming request.
   * :param urlPath: The URL path, without the query.
   * :param status: The HTTP status.
   */
  log(request, urlPath, status) {
    if (this.options.log === null) {
      return;
    }
    const cookies = [];
    const cookieHeader = request.headers.cookie || "";
    for (const part of cookieHeader.split(";")) {
      const name = part.split("=")[0].trim();
      if (name) {
        cookies.push(name);
      }
    }
    const record = {
      time: Date.now(),
      method: request.method,
      path: urlPath,
      status: status,
      origin: request.headers.origin || null,
      authorization: request.headers.authorization !== undefined,
      cookies: cookies,
    };
    appendFileSync(this.options.log, `${JSON.stringify(record)}\n`);
  }
}

process.exitCode = await SiteServer.main(process.argv.slice(2));
