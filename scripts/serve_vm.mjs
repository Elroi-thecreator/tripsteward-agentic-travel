// Production Multi-Site Server for TripSteward on VM (Localhost bindings 8880, 8881, 8882)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const serveScript = join(__dirname, "serve_site.mjs");

const sites = [
  { name: "TripSteward Concierge Hub", dir: join(rootDir, "sites", "tripsteward-hub"), port: 8880 },
  { name: "CityGlide Transfer Node", dir: join(rootDir, "sites", "cityglide-node"), port: 8881 },
  { name: "MetroPass Experiences Node", dir: join(rootDir, "sites", "metropass-node"), port: 8882 },
  { name: "TableBespoke Dining Node", dir: join(rootDir, "sites", "tablebespoke-node"), port: 8883 },
  { name: "AlpineTrail Expeditions Node", dir: join(rootDir, "sites", "alpinetrail-node"), port: 8884 },
  { name: "LuggageFly Logistics Node", dir: join(rootDir, "sites", "luggagefly-node"), port: 8885 },
  { name: "TravelShield Protection Node", dir: join(rootDir, "sites", "travelshield-node"), port: 8886 }
];

const children = [];

for (const site of sites) {
  console.log(`[TripSteward Service] Starting ${site.name} on 127.0.0.1:${site.port}...`);
  const child = spawn(
    process.execPath,
    [serveScript, site.dir, "--host", "127.0.0.1", "--port", String(site.port)],
    { stdio: "inherit" }
  );

  child.on("exit", (code, signal) => {
    console.error(`[TripSteward Service] ${site.name} exited with code ${code} signal ${signal}`);
  });

  children.push(child);
}

function cleanup() {
  console.log("[TripSteward Service] Stopping all sites...");
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
