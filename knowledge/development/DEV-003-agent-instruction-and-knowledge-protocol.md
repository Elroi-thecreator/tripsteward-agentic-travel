# DEV-003: AI Agent Workspace Configuration & Knowledge Discovery Protocol

---
id: "DEV-003"
type: "development"
title: "AI Agent Workspace Configuration & Knowledge Discovery Protocol"
domain: "development"
status: "APPROVED"
version: "1.0.0"
---

## Rule
All autonomous AI coding agents (Antigravity, Claude Code, Gemini CLI, Cursor, GitHub Copilot, Codex, etc.) operating in this repository must discover, prioritize, and adhere to the project's knowledge base before making any planning or implementation decisions:

1. **Agent Entry Points**:
   - Universal root agent instructions must be maintained in `AGENTS.md`.
   - Tool-specific entry configurations must be maintained to ensure seamless discovery across diverse agent tools:
     - `CLAUDE.md` for Anthropic Claude Code.
     - `GEMINI.md` for Google Gemini CLI & Antigravity agents.
     - `.cursorrules` for Cursor IDE.
     - `.github/copilot-instructions.md` for GitHub Copilot.
2. **Mandatory Step 1 — Pre-Change Knowledge Inspection**:
   - Before designing, planning, or editing any code or configuration, the agent MUST read `knowledge/index.yaml`.
   - Inspect all relevant architecture (`ARCH-*`), development (`DEV-*`), product (`PROD-*`), and decision (`ADR-*`) standards that apply to the incoming task.
   - Ground all architectural and implementation decisions in the approved standards.
3. **Mandatory Step 2 — Post-Change Knowledge Synchronization**:
   - Whenever any change is made to routes, schemas, client actions, UI behaviors, or architecture, the agent MUST immediately update the corresponding knowledge units in `knowledge/`.
   - If a new pattern, tool, or standard is introduced, create a new document in `knowledge/` adhering to the required schema (`id`, `type`, `title`, `domain`, `status`, `version`, `rule`, `do`, `dont`, `reason`, `related_items`).
   - Keep `knowledge/index.yaml` synchronized by incrementing `knowledge_units_count`, updating `last_updated`, and listing the new unit under its domain.
4. **Zero-Leakage & Open Agentic Web Invariant**:
   - Agent instructions must explicitly remind all AI assistants that this project operates under 100% in-browser client execution: zero patient data transmission to backend servers, and BYOK inference via Mozilla Otari.

## Do
- Maintain consistent, cross-referenced agent configuration files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`).
- Always direct agents to `knowledge/index.yaml` as the first action upon receiving a prompt.
- Ensure all agent files document the test verification workflow (`npm test`).
- Document all core boundaries (client-side execution, Otari BYOK, CORS headers, user confirmation modals).

## Dont
- Do NOT allow AI agents to modify code without first inspecting `knowledge/index.yaml`.
- Do NOT allow AI agents to leave `knowledge/` out of sync with newly modified codebase features.
- Do NOT allow AI agents to introduce server-side LLM inference or cloud data storage that breaks the zero-leakage privacy model.

## Reason
Autonomous AI agents lack persistent context across sessions and different developer machines. Without explicit top-level agent instruction files, AI assistants often make assumptions, invent novel patterns that violate architectural rules, or fail to find the project's centralized knowledge base. Providing standardized agent instruction files guarantees that any AI tool immediately grounds its actions in approved standards.

## Related Items
- `knowledge/index.yaml`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.cursorrules`
- `.github/copilot-instructions.md`
- `PROD-001`: Open Agentic Web Challenge Specification & Submission Protocol
- `ARCH-002`: TripSteward Autonomous Federated Travel & Cross-Site Booking Architecture
- `DEV-001`: In-Browser Runtime, Site Actions & Otari BYOK Standards
- `DEV-002`: Hackathon Dependencies, Prerequisites & Submission Lifecycle
