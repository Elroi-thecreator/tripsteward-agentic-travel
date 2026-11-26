// Multi-Site Local Development Server for Open Agentic Web Challenge
// Serves tripsteward-hub (8080), cityglide-node (8081), and metropass-node (8082) concurrently with CORS enabled.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const serveScript = join(__dirname, "serve_site.mjs");

const sites = [
  { name: "TripSteward Concierge Hub", dir: join(rootDir, "sites", "tripsteward-hub"), port: 8080 },
  { name: "CityGlide Transfer Node", dir: join(rootDir, "sites", "cityglide-node"), port: 8081 },
  { name: "MetroPass Experiences Node", dir: join(rootDir, "sites", "metropass-node"), port: 8082 },
  { name: "TableBespoke Dining Node", dir: join(rootDir, "sites", "tablebespoke-node"), port: 8083 },
  { name: "AlpineTrail Expeditions Node", dir: join(rootDir, "sites", "alpinetrail-node"), port: 8084 },
  { name: "LuggageFly Logistics Node", dir: join(rootDir, "sites", "luggagefly-node"), port: 8085 },
  { name: "TravelShield Protection Node", dir: join(rootDir, "sites", "travelshield-node"), port: 8086 }
];

console.log("=========================================================");
console.log("✈️  Starting TripSteward Federated Travel Cluster");
console.log("=========================================================\n");

const processes = [];

for (const site of sites) {
  console.log(`Starting ${site.name} on port ${site.port}...`);
  const proc = spawn(
    process.execPath,
    [serveScript, site.dir, "--port", String(site.port), "--host", "127.0.0.1"],
    { stdio: "inherit" }
  );

  processes.push(proc);
}

console.log("\nAll sites running:");
console.log("👉 TripSteward Hub:   http://localhost:8080/");
console.log("👉 CityGlide Node:    http://localhost:8081/");
console.log("👉 MetroPass Node:    http://localhost:8082/");
console.log("\nPress Ctrl+C to terminate all servers.\n");

function cleanup() {
  console.log("\nShutting down servers...");
  for (const proc of processes) {
    proc.kill();
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
