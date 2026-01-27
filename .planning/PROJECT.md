# Mastra Browser Tools

## What This Is

A browser toolset integration for Mastra agents that enables web page navigation and interaction using the agent-browser library. Agents can navigate to URLs, capture accessibility snapshots, interact with elements via refs, and take screenshots — enabling research and data gathering from dynamic websites.

## Core Value

Agents can browse and interact with real websites to gather information that requires JavaScript rendering or user interaction.

## Current State (v1.0 shipped)

**Package:** `integrations/agent-browser/`
**Lines of code:** 1,446 TypeScript
**Tools:** 7 (navigate, snapshot, click, type, select, scroll, screenshot)
**Build:** ESM + CJS with TypeScript declarations

## Requirements

### Validated

- [x] Toolset exposes core browser primitives (navigate, snapshot, click, type, scroll) — v1.0
- [x] Screenshot capture tool for visual documentation — v1.0
- [x] Uses agent-browser programmatic API (BrowserManager, not CLI) — v1.0
- [x] Follows Mastra integration patterns (lives in integrations/agent-browser) — v1.0
- [x] Browser lifecycle managed within toolset (launch on first use, cleanup) — v1.0
- [x] Accessibility snapshots return element refs for LLM-friendly targeting — v1.0

### Active

- [ ] Live browser screencast streams to Studio during tool execution — v1.1
- [ ] Snapshot history captured for session replay — v1.1
- [ ] Browser view renders inline with agent chat in Studio — v1.1

### Out of Scope

- Session persistence (cookies/storage across agent runs) — v2
- Dedicated form-filling workflows — v2, basic type+click sufficient for v1
- Cloud browser providers (Browserbase, etc.) — v2
- Network interception — v2
- Multi-tab support — v2
- PDF capture — v2
- Testing/QA use cases — research focus for v1

## Current Milestone: v1.1 Browser Live View

**Goal:** Enable users to watch browser agents work in real-time from within Mastra Studio.

**Target features:**
- Live screencast of browser viewport streaming to Studio
- Snapshot history for session replay
- Browser view inline with agent chat panel
- View-only (no user interaction with browser from UI)

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
| Programmatic API over CLI | Cleaner integration, no process spawning, native async | Good |
| Toolset over individual tools | Cohesive developer experience, managed browser lifecycle | Good |
| integrations/ location | Follows existing Mastra patterns for external tool integrations | Good |
| Zod schemas with .describe() | LLM-friendly tool parameter documentation | Good |
| Singleton Promise pattern for getBrowser | Prevents concurrent browser launches, thread-safe | Good |
| Types.ts as single source of truth | Eliminates schema duplication, prevents drift | Good |
| @e ref format from agent-browser | LLM-friendly element targeting, deterministic | Good |
| BrowserToolError unified interface | Consistent error handling with recovery hints | Good |

---
*Last updated: 2026-01-27 after v1.1 milestone start*
