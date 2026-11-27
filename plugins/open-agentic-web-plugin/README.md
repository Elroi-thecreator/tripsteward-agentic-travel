# Open Agentic Web Plugin & MCP Server

Official Autonomous AI Agent Plugin for the **Open Agentic Web** specification (Cognizant / Mozilla / MIT NANDA MVP Profile 0.3).

This plugin provides Model Context Protocol (MCP) servers, devtools skills, and security guardrails to let any AI agent (Claude Desktop, Cursor, Antigravity, Gemini CLI) inspect, scaffold, validate, and execute grounded actions across agentic web nodes.

---

## 📦 What's Included

1. **Model Context Protocol (MCP) Server**:
   - Zero-dependency JSON-RPC 2.0 stdio server (`open-agentic-web/mcp`).
   - Automatically surfaces all declared website tools (`website_search_rooms`, `website_hold_room`, `website_dispatch_chauffeur`, `website_issue_pass`) as executable MCP tools.
   - Provides built-in auditing tools: `oaw_validate_node`, `oaw_audit_federation`, `oaw_list_actions`, `oaw_generate_a2a`.

2. **Agent Skills**:
   - `open-agentic-web-devtools`: Complete reference for auditing manifests, networks, peer links, and running conformance checks.
   - `open-agentic-web-actions`: Guide for authoring safe, schema-validated site actions with ECDSA cryptographic receipts.

---

## 🚀 Installation & Setup

### 1. In Claude Desktop / Claude Code
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "open-agentic-web": {
      "command": "node",
      "args": [
        "/path/to/devpost-Cognizant/packages/open-agentic-web/bin/mcp-server.mjs"
      ]
    }
  }
}
```

### 2. In Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "open-agentic-web": {
      "command": "node",
      "args": [
        "${workspaceFolder}/packages/open-agentic-web/bin/mcp-server.mjs"
      ]
    }
  }
}
```

### 3. In Google Antigravity / Gemini CLI
Symlink or copy this plugin folder to your plugins directory:
```bash
ln -s /path/to/devpost-Cognizant/plugins/open-agentic-web-plugin ~/.gemini/config/plugins/open-agentic-web-plugin
```

---

## 🛠️ Standalone CLI Usage
```bash
# Validate local node or remote URL
npx open-agentic-web validate sites/tripsteward-hub

# Audit cross-site federation mesh
npx open-agentic-web federation sites/tripsteward-hub sites/cityglide-node sites/metropass-node

# Start MCP server manually
npx open-agentic-web mcp sites/tripsteward-hub sites/cityglide-node
```
