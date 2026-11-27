#!/usr/bin/env node

/**
 * Open Agentic Web - Standalone MCP Server Binary
 * Starts a standard Model Context Protocol (MCP) server over stdio.
 * Compatible with Claude Desktop, Cursor, Antigravity, and Gemini CLI.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createMCPServer } from "../src/mcp.js";

const args = process.argv.slice(2);
let siteDirs = args.filter(a => !a.startsWith("-"));

// If no directories supplied, auto-discover common site directories
if (siteDirs.length === 0) {
  const defaultDirs = [
    "sites/tripsteward-hub",
    "sites/cityglide-node",
    "sites/metropass-node",
    "."
  ];
  siteDirs = defaultDirs.filter(d => existsSync(resolve(d)));
}

const server = createMCPServer({ siteDirs });

await server.ready();
server.startStdio();
