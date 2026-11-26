# TripSteward Knowledge Base

This directory is the **authoritative Single Source of Truth** for all architectural, development, product, and decision standards for the TripSteward project and its implementation of the Open Agentic Web specification.

---

## 🗂️ Structure & Domains

```
knowledge/
├── index.yaml             # Master catalog of all registered knowledge units
├── README.md              # This directory overview and usage guide
├── product/               # Product requirements, hackathon rules, specs (PROD-*)
├── architecture/          # System design, multi-agent topology, privacy (ARCH-*)
├── development/           # Runtime, BYOK inference, site actions, toolchains (DEV-*)
└── decision/              # Architectural Decision Records (ADR-*)
```

---

## 📖 Mandatory Agent Protocol

Every AI agent operating in this repository must follow a two-step protocol:

### Step 1: Pre-Change Knowledge Inspection
1. Read `knowledge/index.yaml` before touching any code.
2. Identify all relevant `PROD-*`, `ARCH-*`, `DEV-*`, and `ADR-*` documents.
3. Read the relevant documents and ground all decisions, code generation, and configuration in these standards.

### Step 2: Post-Change Knowledge Synchronization
1. Update existing knowledge units when modifying related code, routes, tools, or schemas.
2. If introducing a new architectural pattern, product rule, or decision, create a new document in the appropriate domain folder adhering to the schema below.
3. Update `knowledge/index.yaml`:
   - Increment `knowledge_units_count`
   - Update `last_updated` date
   - Add the new unit under its domain

---

## 📋 Standard Knowledge Unit Schema

Every knowledge markdown document must follow this frontmatter and section format:

```markdown
# ID: Title

---
id: "DOMAIN-XXX"
type: "product" | "architecture" | "development" | "decision"
title: "Document Title"
domain: "product" | "architecture" | "development" | "decision"
status: "APPROVED" | "DRAFT" | "DEPRECATED"
version: "1.0.0"
---

## Rule
Core normative policy or invariant that must be upheld.

## Do
- Prescribed implementation behaviors and best practices.

## Dont
- Prohibited patterns, security anti-patterns, or architectural violations.

## Reason
Rationale and justification explaining why this standard exists.

## Related Items
- Cross-references to other knowledge units, specifications, or code files.
```
