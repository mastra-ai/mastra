# Project Research Summary

**Project:** Mastra Browser Tools v1.1 - Live Screencast Streaming
**Domain:** Browser automation live preview for AI agent debugging
**Researched:** 2026-01-27
**Confidence:** HIGH

## Executive Summary

The Browser Live View feature adds real-time screencast streaming to Mastra Studio, enabling users to watch browser agents work in real-time. The existing `agent-browser` library (v0.8.0) provides a complete CDP-based screencast API with `startScreencast()`, `stopScreencast()`, and input injection methods. The primary work is building the transport layer (WebSocket from server to Studio) and the React UI components to display frames inline with agent chat.

The recommended approach is a three-layer architecture: (1) extend `BrowserToolset` with screencast control methods, (2) add a WebSocket route to `@mastra/server` for frame delivery, and (3) create a `BrowserViewPanel` React component that updates via refs to avoid virtual DOM thrashing. This approach reuses the existing singleton browser pattern and keeps screencast lifecycle co-located with browser lifecycle.

Key risks center on CDP frame acknowledgment (missing acks cause memory exhaustion), React rendering performance (base64 through state causes UI freezes), and WebSocket connection cleanup (leaked connections cause server memory growth). All three have well-documented prevention patterns. The view-only v1 scope is appropriate - user interaction with the browser should be explicitly deferred to v2.

## Key Findings

### Recommended Stack

The agent-browser library already provides everything needed for screencast capture. No new browser automation dependencies are required.

**Core technologies:**
- **agent-browser (^0.8.0):** Screencast source - provides `startScreencast()`, `stopScreencast()`, `injectMouseEvent()`, `injectKeyboardEvent()` via CDP
- **WebSocket (ws ^8.19.0):** Frame transport - binary-capable, bidirectional for future input injection, already a dep of agent-browser
- **Native `<img>` tag + useRef:** Frame display - simplest approach, bypass React virtual DOM diffing

**NOT recommended:**
- WebRTC (overkill for 1-5 FPS server-to-client frames)
- Socket.IO (plain WebSocket sufficient)
- Canvas rendering (adds complexity without benefit for static frames)
- SSE (text-only, no bidirectional for future input injection)

### Expected Features

**Must have (table stakes):**
- Real-time video stream via CDP Page.startScreencast
- Connection status indicator (connected/connecting/disconnected)
- Stream start/stop lifecycle tied to browser launch/close
- Graceful degradation ("no active browser" state when browser not running)
- Basic loading state during 1-3 second initialization
- Reasonable latency (target <500ms, acceptable <2s)

**Should have (differentiators for v1.5):**
- Current URL display
- Page title in header
- Resize/zoom controls
- Action overlay/highlights

**Defer (v2+):**
- User interaction with browser (explicitly out of scope for v1)
- Timeline scrubbing and session recording
- Picture-in-picture mode
- Multi-tab indicators

### Architecture Approach

The architecture follows a clean separation: BrowserToolset owns the browser lifecycle and screencast API, the Mastra server handles WebSocket connections and frame relay, and the Studio UI renders frames via direct DOM manipulation. The key insight is that screencast is an observation layer parallel to tool execution - it watches but does not interfere with agent actions.

**Major components:**
1. **BrowserToolset extension** - Add `startScreencast()`, `stopScreencast()`, and input injection passthrough methods to existing class
2. **BrowserStreamHandler** - New WebSocket handler in `@mastra/server` that upgrades connections and relays CDP frames
3. **BrowserViewPanel** - New React component using `useRef` for frame display, avoiding virtual DOM thrashing
4. **AgentLayout modification** - Add `browserSlot` prop to existing layout for panel composition

### Critical Pitfalls

1. **Missing CDP frame acknowledgment** - CDP requires `screencastFrameAck({ sessionId })` for each frame. Without it, Chrome buffers frames indefinitely causing memory exhaustion. Prevention: Ack immediately before processing each frame.

2. **Base64 through React state** - Storing ~100KB base64 frames in state causes virtual DOM diffing on every frame, freezing UI at 10+ FPS. Prevention: Use `useRef` for direct DOM manipulation, bypassing React rendering.

3. **WebSocket connection array leak** - Connections added on open but not removed on close. Prevention: Use `Set<WebSocket>` with explicit `delete()` in both `close` and `error` handlers.

4. **Zombie browser processes** - Browser processes remain after Node.js crash or abnormal termination. Prevention: Signal handlers (SIGINT, SIGTERM, uncaughtException) that call `browser.close()`.

5. **Screencast without viewers** - Wasting CPU encoding frames nobody receives. Prevention: Track viewer count, start screencast only when viewerCount > 0.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: BrowserToolset Screencast Extension

**Rationale:** Foundation phase - screencast control must be co-located with browser lifecycle since BrowserToolset already owns the singleton BrowserManager. This enables incremental testing before server/UI work.

**Delivers:**
- `startScreencast()`, `stopScreencast()` methods on BrowserToolset
- Input injection passthrough (`injectMouseEvent()`, `injectKeyboardEvent()`)
- Unit tests for new methods

**Addresses:** Core screencast API exposure
**Avoids:** Zombie processes (extend existing close() pattern), CDP frame ack (implement correctly from start)

### Phase 2: WebSocket Server Endpoint

**Rationale:** Bridge phase - requires Phase 1 complete. WebSocket chosen over SSE for bidirectional capability (future input injection) and binary frame support. Hono supports WebSocket via adapter.

**Delivers:**
- `/browser/:agentId/stream` WebSocket route
- Session management (one stream per agent)
- Frame relay with proper ack handling
- Connection cleanup on disconnect

**Addresses:** Frame transport, connection status
**Avoids:** WebSocket memory leak (cleanup handlers), screencast without viewers (viewer count tracking)

### Phase 3: Studio UI Components

**Rationale:** Experience phase - requires Phase 2 complete (needs real endpoint). Focus on correct frame rendering pattern.

**Delivers:**
- BrowserViewPanel component with `useRef` pattern
- Connection status indicator
- Loading and empty states
- AgentLayout modification with browserSlot

**Addresses:** All table stakes features (stream, status, lifecycle, degradation, loading, latency)
**Avoids:** Base64 virtual DOM thrashing (useRef pattern), Object URL memory leak (if using that approach)

### Phase 4: Integration and Polish

**Rationale:** Completion phase - wire everything together, add polish.

**Delivers:**
- Full agent page integration
- Browser detection (show panel only when agent has browser tools)
- E2E tests for complete flow
- Performance tuning (frame rate, quality defaults)

**Addresses:** Production readiness
**Avoids:** Out-of-order frames (timestamp filtering), tab visibility issues (reconnection logic)

### Phase Ordering Rationale

- **Phases 1-2-3 strict dependency chain:** Each phase builds on the previous - cannot build server endpoint without screencast API, cannot build UI without server endpoint
- **Phase 4 parallel potential:** Some integration work could start once Phase 3 skeleton exists
- **Pitfall prevention built in:** Critical pitfalls (CDP ack, React rendering, WebSocket cleanup) are addressed in their respective phases, not deferred

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Hono WebSocket adapter specifics for Bun vs Node runtime - need to verify compatibility during phase planning

Phases with standard patterns (skip research-phase):
- **Phase 1:** BrowserToolset extension - clear patterns from existing codebase
- **Phase 3:** React component patterns - well-documented useRef approach for streaming
- **Phase 4:** Integration - follows existing Mastra playground patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | agent-browser API verified from type definitions; WebSocket is established pattern |
| Features | HIGH | CDP screencast capabilities documented; table stakes clear from competitive analysis |
| Architecture | HIGH | Component boundaries verified from codebase inspection; data flow is straightforward |
| Pitfalls | MEDIUM | CDP pitfalls from documentation; React/WebSocket pitfalls from community experience |

**Overall confidence:** HIGH

### Gaps to Address

- **Hono WebSocket adapter:** Need to verify runtime-specific configuration (Bun vs Node) during Phase 2 planning
- **Multi-viewer support:** Not addressed in v1 - single viewer per stream assumed. May need consideration if multiple Studio tabs view same agent.
- **Frame rate tuning:** Performance defaults are estimates. Will need empirical tuning during Phase 4.

## Sources

### Primary (HIGH confidence)
- agent-browser v0.8.0 type definitions - screencast API, input injection methods
- Chrome DevTools Protocol Page domain - CDP screencast specification, frame ack requirement
- Mastra server codebase inspection - route patterns, no existing WebSocket routes
- playground-ui codebase inspection - AgentLayout slots, React patterns

### Secondary (MEDIUM confidence)
- WebSocket vs SSE comparison articles - transport decision rationale
- React useRef optimization patterns - rendering performance approach
- Puppeteer/Playwright community issues - CDP pitfalls and workarounds

### Tertiary (LOW confidence)
- Competitive feature analysis (Browserbase, AgentCore) - feature prioritization
- Frame rate/quality estimates - need empirical validation

---
*Research completed: 2026-01-27*
*Ready for roadmap: yes*
