# Mastra Browser Tools

## What This Is

A browser toolset integration for Mastra agents that enables web page navigation and interaction using the agent-browser library. Agents can navigate to URLs, capture accessibility snapshots, interact with elements via refs, and take screenshots — enabling research and data gathering from dynamic websites.

## Core Value

Agents can browse and interact with real websites to gather information that requires JavaScript rendering or user interaction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Toolset exposes core browser primitives (navigate, snapshot, click, type, scroll)
- [ ] Screenshot capture tool for visual documentation
- [ ] Uses agent-browser programmatic API (BrowserManager, not CLI)
- [ ] Follows Mastra integration patterns (lives in integrations/agent-browser)
- [ ] Browser lifecycle managed within toolset (launch on first use, cleanup)
- [ ] Accessibility snapshots return element refs for LLM-friendly targeting

### Out of Scope

- Session persistence (cookies/storage across agent runs) — v2
- Dedicated form-filling workflows — v2, basic type+click sufficient for v1
- Cloud browser providers (Browserbase, etc.) — v2
- Network interception — v2
- Multi-tab support — v2
- PDF capture — v2
- Testing/QA use cases — research focus for v1

## Context

**Mastra Framework:**
- Existing modular AI framework with agents, workflows, tools, memory
- Tools are dynamically composed from multiple sources (assigned, memory, toolsets, MCP)
- Toolsets bundle related capabilities for cohesive developer experience
- Integrations live in `integrations/` directory

**agent-browser Library:**
- Vercel Labs project: https://github.com/vercel-labs/agent-browser
- Provides headless browser automation optimized for AI agents
- Key pattern: accessibility snapshots with deterministic refs (`@e1`, `@e2`) for element targeting
- Programmatic API via `BrowserManager` class (launch, navigate, inject events, screencast)
- Designed for LLM workflows — structured snapshots instead of brittle selectors

**Codebase Reference:**
- See `.planning/codebase/` for full architecture mapping
- Tool patterns in `packages/core/src/tools/`
- Integration patterns in `integrations/`

## Constraints

- **Library**: Must use agent-browser (not Puppeteer/Playwright directly)
- **Location**: Lives in `integrations/agent-browser` following existing patterns
- **API Style**: Toolset pattern — cohesive bundle of related tools
- **State**: Browser instance lifecycle managed internally (not user-managed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Programmatic API over CLI | Cleaner integration, no process spawning, native async | — Pending |
| Toolset over individual tools | Cohesive developer experience, managed browser lifecycle | — Pending |
| integrations/ location | Follows existing Mastra patterns for external tool integrations | — Pending |

---
*Last updated: 2026-01-26 after initialization*
