# Mastra Browser Tools

## What This Is

A browser toolset integration for Mastra agents that enables web page navigation, interaction, and real-time live view with user input injection using the agent-browser library. Agents can navigate to URLs, capture accessibility snapshots, interact with elements via refs, take screenshots, and stream their browser session live to Mastra Studio. Users can click, type, and scroll in the live view to assist agents with CAPTCHAs, logins, and other interactive elements.

## Core Value

Agents can browse real websites and users can watch and assist them in real-time from within Studio.

## Current State (v1.2 shipped)

**Package:** `integrations/agent-browser/` + `packages/deployer/` (transport) + `packages/playground-ui/` (UI)
**Lines of code:** ~5,700 TypeScript across 3 packages
**Tools:** 7 (navigate, snapshot, click, type, select, scroll, screenshot)
**Live View:** CDP screencast → WebSocket → React panel with tool call history
**Input Injection:** Click, keyboard, scroll forwarding with coordinate mapping and focus management
**Build:** ESM + CJS with TypeScript declarations

## Requirements

### Validated

- [x] Toolset exposes core browser primitives (navigate, snapshot, click, type, scroll) — v1.0
- [x] Screenshot capture tool for visual documentation — v1.0
- [x] Uses agent-browser programmatic API (BrowserManager, not CLI) — v1.0
- [x] Follows Mastra integration patterns (lives in integrations/agent-browser) — v1.0
- [x] Browser lifecycle managed within toolset (launch on first use, cleanup) — v1.0
- [x] Accessibility snapshots return element refs for LLM-friendly targeting — v1.0
- [x] Live browser screencast streams to Studio during tool execution — v1.1
- [x] Browser view renders inline with agent chat in Studio — v1.1
- [x] Tool call history displayed in browser panel — v1.1
- [x] User can click on the live view frame to interact with browser elements — v1.2
- [x] User can type in the live view to fill forms or enter text — v1.2
- [x] User can scroll in the live view to navigate long pages — v1.2
- [x] Coordinate mapping translates frame clicks to browser viewport coordinates — v1.2
- [x] Agent-busy coordination prevents destructive races during tool execution — v1.2

### Active

(None — next milestone requirements TBD)

### Out of Scope

- Session persistence (cookies/storage across agent runs) — v2
- Dedicated form-filling workflows — v2, basic type+click sufficient for v1
- Cloud browser providers (Browserbase, etc.) — v2
- Network interception — v2
- Multi-tab support — v2
- PDF capture — v2
- Testing/QA use cases — research focus for v1
- Session recording/playback — v2
- Multi-viewer sync — v2
- Full takeover mode (user exclusively controls browser) — v1.3, start with assist mode

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
| WebSocket over SSE | Bidirectional capability for future input injection | Good |
| useRef for frame display | Bypasses React virtual DOM, prevents re-renders per frame | Good |
| typed-emitter for events | Type-safe event emitter pattern for screencast stream | Good |
| @hono/node-ws for WebSocket | Native WebSocket support in Hono server | Good |
| ViewerRegistry reference counting | Start screencast on first viewer, stop on last | Good |
| setupBrowserStream before CORS | Prevents WebSocket upgrade header conflicts | Good |
| Single BrowserViewFrame instance | CSS-only visibility toggling prevents WebSocket churn | Good |
| Panel outside ThreadPrimitive.Viewport | Survives message re-renders without state loss | Good |
| Panel hides on user X click only | No auto-hide on browser_closed preserves last frame | Good |
| everyNthFrame: 1 for headless | Chrome generates fewer frames without display cycle | Good |
| BrowserToolCallsContext bridge | React Context bridges ToolFallback and BrowserViewPanel | Good |
| ClientInputMessage discriminated union | Type field discriminates mouse/keyboard, eventType for CDP subtypes | Good |
| Viewport metadata as separate JSON message | Keeps raw base64 frame protocol unchanged, metadata sent alongside | Good |
| Fire-and-forget input injection | No ack latency, client responsible for throttle, CDP handles errors | Good |
| object-fit:contain letterbox coordinate mapping | Pure function maps scaled img clicks to browser viewport CSS pixels | Good |
| rAF throttle at 30fps for mouse move | Prevents WebSocket/CDP flood from high-frequency mousemove events | Good |
| key.length === 1 for printable detection | Single Unicode codepoint distinguishes printable from special keys | Good |
| Escape consumed by hook, never forwarded | Escape exits interactive mode rather than being sent to remote browser | Good |
| IME guard with isComposing + keyCode 229 | Cross-browser compatibility for IME input composition | Good |
| Interactive mode gated by frame click | Explicit opt-in prevents accidental keyboard capture | Good |
| Container-relative ripple coordinates | Display-space CSS pixels avoid coordinate system coupling | Good |
| Agent-busy derived from BrowserToolCallsContext | No new infrastructure, derives isAgentBusy from pending tool calls | Good |
| Mouse suppressed, keyboard continues during agent | Click/scroll cause destructive races, keyboard is safe to continue | Good |
| Ring color green→amber for agent busy | Visual state distinction without extra UI elements | Good |

---
*Last updated: 2026-01-30 after v1.2 milestone completion*
