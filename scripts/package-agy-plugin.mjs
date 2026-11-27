#!/usr/bin/env node

/**
 * Antigravity (AGY) Plugin Packaging & Marketplace Bundle Script
 * Creates a clean release zip archive of the open-agentic-web-plugin
 * adhering strictly to the Antigravity Marketplace specification.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const pluginDir = join(rootDir, "plugins", "open-agentic-web-plugin");
const distDir = join(rootDir, "dist");

console.log("📦 Packaging Open Agentic Web Plugin for Antigravity Marketplace...");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const manifest = JSON.parse(readFileSync(join(pluginDir, "plugin.json"), "utf-8"));
const bundleName = `${manifest.name}-${manifest.version}.zip`;
const bundlePath = join(distDir, bundleName);

if (existsSync(bundlePath)) {
  rmSync(bundlePath);
}

// Create distribution bundle with python3 zipfile to avoid system zip dependencies
execSync(
  `python3 -c '
import zipfile, os

plugin_dir = "${pluginDir}"
bundle_path = "${bundlePath}"

with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(plugin_dir):
        # Ignore git or scratch files
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules"]
        for file in files:
            if file.startswith(".") or file.endswith(".tmp"):
                continue
            full_path = os.path.join(root, file)
            arc_name = os.path.relpath(full_path, plugin_dir)
            z.write(full_path, arc_name)
'
`,
  { stdio: "inherit" }
);

console.log(`✅ Antigravity Plugin Bundle Created: ${bundlePath}`);
console.log(`   - Name: ${manifest.name}`);
console.log(`   - Display Name: ${manifest.displayName}`);
console.log(`   - Version: ${manifest.version}`);
console.log(`   - Logo: ${manifest.logo}`);
console.log(`   - Suggested Prompts: ${manifest.suggestedPrompts.length}`);
