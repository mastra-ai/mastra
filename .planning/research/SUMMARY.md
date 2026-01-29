# Project Research Summary

**Project:** v1.2 Browser Input Injection
**Domain:** User input injection for browser automation live view
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

User input injection adds bidirectional interaction to the existing browser live view, enabling users to click, type, and scroll in the Studio UI to unblock agents stuck on CAPTCHAs, popups, or login prompts. The research reveals **zero new dependencies are required** — every component already exists in the codebase. The work is pure integration: capturing DOM events in React, serializing over WebSocket, and calling existing `BrowserToolset.injectMouseEvent()` / `injectKeyboardEvent()` methods that wrap CDP `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent`.

The core technical challenge is **coordinate mapping with letterboxing**. The live view displays a scaled JPEG frame using `object-contain`, which may add black bars. User clicks on this image must be transformed to CSS pixel coordinates in the actual browser viewport, accounting for both scaling and letterbox offsets. This requires viewport metadata (width, height) which is available per-frame but currently stripped during broadcast. Two critical infrastructure gaps must be fixed first: (1) `BrowserToolsetLike` interface is missing the inject methods, and (2) viewport metadata must reach the client.

The dominant risk is **coordinate mapping errors** that cause clicks to land on wrong elements, with error growing from center to corners. Four critical pitfalls threaten usability: off-by-one coordinate mapping from letterboxing math, CDP click silently failing without explicit `button:'left'` and `clickCount:1`, race conditions between user and agent actions, and stale frames causing ghost clicks. All four can be mitigated with disciplined implementation: pure-function coordinate mapping with letterbox offset calculation, complete CDP event sequences (mouseMoved → mousePressed → mouseReleased), input coordination state machine or basic locking, and client-side visual feedback overlays. The "assist mode" pattern (user and agent coexist, no explicit takeover) has converged across industry (Browserbase, AWS AgentCore, OpenAI Operator) and is the correct model for v1.2.

## Key Findings

### Recommended Stack

All required infrastructure exists in the codebase. Zero new npm dependencies needed.

**Core technologies:**
- **CDP `Input.dispatchMouseEvent`** (already wrapped by `BrowserManager.injectMouseEvent()`) — Sends mouse events to browser with x/y in CSS pixels relative to viewport
- **CDP `Input.dispatchKeyEvent`** (already wrapped by `BrowserManager.injectKeyboardEvent()`) — Sends keyboard events with keyDown → char → keyUp sequence for text input
- **Existing WebSocket at `/browser/:agentId/stream`** (bidirectional, unused client-to-server direction) — Transport layer for input events
- **React DOM events** (onMouseDown/Up/Move, onKeyDown/Up, onWheel) — Native browser events capture user input
- **ScreencastFrameData.viewport** (available but not broadcast) — Contains width, height, offsetTop, scrollOffset, pageScaleFactor needed for coordinate mapping

**Infrastructure gaps requiring fixes:**
1. **`BrowserToolsetLike` interface missing inject methods** — Server gets toolset via this interface but cannot call inject methods. Concrete `BrowserToolset` class has the methods, but interface omits them. Must extend interface in `packages/core/src/agent/types.ts`.
2. **Viewport metadata not reaching client** — `ViewerRegistry.broadcastFrame()` sends only `frame.data` (base64 string), discarding viewport dimensions. Client needs viewport width/height for coordinate mapping. Must broadcast viewport metadata on stream start and dimension changes.

### Expected Features

**Must have (table stakes) — without these, input injection is broken:**
- **Click forwarding** — User clicks img element, click dispatched to browser at mapped coordinates
- **Keyboard input forwarding** — User types while panel focused, keystrokes sent to browser as CDP key events
- **Focus management** — Explicit activation (click on frame to enter interactive mode), prevents keyboard trap in chat input
- **Coordinate mapping** — Transform img element coordinates to viewport coordinates accounting for `object-contain` letterboxing
- **Scroll forwarding** — User wheel events dispatched as CDP mouseWheel events
- **WebSocket protocol** — JSON message format with `type` discriminator (mouse, keyboard) for client-to-server messages
- **Interactive mode indicator** — Visual feedback (border highlight, badge change, cursor change) showing when input is captured

**Should have (include if straightforward):**
- **Modifier key support** — Ctrl+click, Shift+click, Alt+key combinations (low complexity, included in event handlers)
- **Right-click prevention** — Forward right-clicks to browser, not host context menu (low complexity, `preventDefault()` on contextmenu)
- **Click ripple effect** — Immediate visual confirmation at click point before browser responds (low complexity, CSS animation overlay)

**Defer (v1.3):**
- **Cursor position tracking** — Overlay showing mapped cursor position as user moves mouse (medium complexity, coordinate overlay)
- **Agent pause/resume controls** — Explicit buttons to stop/start agent during user interaction (high complexity, agent integration)
- **Touch event support** — Tap, drag, pinch on mobile/tablet devices (medium complexity, mobile use case)
- **Keyboard shortcut pass-through** — System keys (Ctrl+C/V/A) forwarded to browser not host (medium complexity, Keyboard Lock API)

**Anti-features (deliberately NOT building):**
- Full takeover mode (agent suspends entirely)
- Simultaneous input conflict resolution (queuing, priority, locks beyond basic coordination)
- Element hover highlights (requires CDP round-trip per mousemove)
- Drag-and-drop support (latency makes drag feel broken)
- File upload via drag-and-drop (complex file transfer protocol)
- Clipboard sync (requires secure context permissions)
- Mouse cursor style sync (dual-cursor problem, CDP round-trip per move)

### Architecture Approach

Input injection extends the existing browser live view with bidirectional WebSocket communication. User events flow: React event handler → coordinate mapping (client-side) → WebSocket JSON message → server `onMessage` handler → `BrowserToolset.injectMouseEvent/injectKeyboardEvent` → `BrowserManager` CDP dispatch → Chromium processes event → new frame captured → broadcast back to client.

**Major components:**
1. **BrowserViewFrame (React)** — Captures mouse/keyboard events on img container, maps coordinates accounting for `object-contain` letterboxing, sends JSON messages via WebSocket
2. **useBrowserStream hook** — Extended to expose `sendInputMessage()` function and `viewport` state (width, height), parses viewport metadata messages from server
3. **browser-stream.ts onMessage handler** — Parses JSON input messages, validates structure, routes to `BrowserToolset` via `config.getToolset(agentId)`
4. **ViewerRegistry** — Extended to broadcast viewport metadata on stream start and dimension changes, preserves existing raw base64 frame protocol for performance
5. **Coordinate mapping utility** — Pure function computing viewport coordinates from img element click position, accounting for letterbox offset with `object-contain`
6. **BrowserToolsetLike interface** — Extended to include `injectMouseEvent()` and `injectKeyboardEvent()` signatures matching concrete implementation

**Key data flow decision:** Coordinate mapping happens **client-side**. Client has both img element dimensions and viewport metadata. Server receives pre-mapped viewport coordinates and passes directly to CDP. This keeps server trivially simple and eliminates a round-trip.

### Critical Pitfalls

1. **Coordinate mapping off-by-growing-error from letterboxing** — Clicks near top-left are correct but error grows toward bottom-right until corner clicks are completely off-target. Caused by `object-contain` letterboxing not accounted for in mapping formula. **Prevention:** Compute separate X/Y letterbox offsets, use naturalWidth/naturalHeight, validate with visual debug overlay at multiple panel aspect ratios.

2. **CDP click silently fails (no error, no effect)** — `Input.dispatchMouseEvent` called but nothing happens on page. Caused by default `button:'none'` and `clickCount:0` which prevent click event synthesis. **Prevention:** Always send 3-event sequence (mouseMoved → mousePressed → mouseReleased) with explicit `button:'left'` and `clickCount:1`, never rely on defaults.

3. **Race condition between user input and agent tool calls** — User clicks CAPTCHA while agent executes `browser_click`, both interact simultaneously causing stale refs, element invalidation, double actions. No coordination mechanism exists. **Prevention:** Input lock state machine (IDLE → AGENT_ACTIVE → USER_ACTIVE) or basic lock during agent tool execution, notify agent of page changes after user input.

4. **Stale frame coordinate mismatch (clicking ghost elements)** — User sees frame from 500ms-2s ago, clicks on element visible in that frame, but page has changed (element moved, removed, or scrolled). Click lands on whatever is currently at those coordinates. **Prevention:** Freshness indicator showing frame age, visual confirmation overlay on next frame, mouse move tracking to keep browser cursor position synced.

5. **Keyboard event missing `char` type** — Text does not appear in input fields despite key events dispatched. Caused by sending only keyDown/keyUp without the `char` event that actually inserts text. **Prevention:** Send 3-event sequence for printable characters (keyDown → char with text → keyUp), only 2-event for special keys (Enter, Escape, arrows).

## Implications for Roadmap

Based on research, input injection requires a strict build order due to hard dependencies. Parallelization is minimal because client needs server infrastructure (viewport metadata) and server needs interface extensions before routing can work.

### Phase 1: Infrastructure Foundations
**Rationale:** Must fix interface gaps before any input routing can work. The server's `onMessage` handler cannot call inject methods without the interface extension, and the client cannot map coordinates without viewport dimensions.

**Delivers:**
- `BrowserToolsetLike` interface extended with `injectMouseEvent()` and `injectKeyboardEvent()` signatures
- Viewport metadata broadcast on stream start and dimension changes (preserving raw base64 frames for performance)
- `ClientInputMessage` union types defined (MouseInputMessage | KeyboardInputMessage)

**Addresses:** Infrastructure gaps identified in STACK.md and FEATURES.md
**Avoids:** Cannot proceed without these — all downstream work depends on interface and metadata delivery

### Phase 2: Server Input Routing
**Rationale:** With interface extended and viewport available, server can now route input messages to toolset. This must complete before client can send useful input events.

**Delivers:**
- `onMessage` handler implementation in browser-stream.ts (parse JSON, switch on type, call toolset.injectMouseEvent/injectKeyboardEvent)
- Server-side validation and error handling for malformed input messages
- Fire-and-forget pattern (no acknowledgment latency)

**Uses:** Extended `BrowserToolsetLike` interface, existing WebSocket transport
**Implements:** Server-side input routing component from ARCHITECTURE.md
**Avoids:** Pitfall 2 (CDP silent failure) by implementing correct event sequences in toolset calls

### Phase 3: Client Coordinate Mapping and Click
**Rationale:** With viewport metadata available and server routing ready, client can now send mapped click events. Coordinate mapping is the most complex client logic and must be correct before visual interactions work.

**Delivers:**
- Pure coordinate mapping function accounting for `object-contain` letterboxing
- Mouse event handlers (onMouseDown, onMouseUp, onMouseMove throttled)
- JSON message serialization and WebSocket send via hook
- Modifier key bitmask computation

**Addresses:** Table stakes features (click forwarding, coordinate mapping, scroll forwarding)
**Avoids:** Pitfall 1 (coordinate mapping error) with pure-function approach and letterbox offset calculation
**Implements:** BrowserViewFrame event handlers, coordinate mapping utility from ARCHITECTURE.md

### Phase 4: Focus Management and Keyboard
**Rationale:** Keyboard input depends on focus management (click-to-activate pattern) to prevent accidental input. This phase can proceed independently of Phase 3 but requires Phase 2 server routing.

**Delivers:**
- Focus management with tabIndex container and visual indicators
- Keyboard event handlers (onKeyDown, onKeyUp, onContextMenu)
- 3-event sequence for printable characters (keyDown → char → keyUp)
- Escape hatch (Escape or click outside to exit keyboard capture)

**Addresses:** Table stakes features (keyboard forwarding, focus management, interactive mode indicator)
**Avoids:** Pitfall 5 (missing char event) and Pitfall 9 (no focus before type) with disciplined event sequences
**Implements:** Focus state machine from FEATURES.md assist mode pattern

### Phase 5: Visual Feedback and Polish
**Rationale:** Basic input injection works after Phases 1-4. This phase adds visual confirmation that makes the feature feel responsive despite frame latency.

**Delivers:**
- Click ripple effect overlay at click position
- Frame staleness indicator (age display)
- Interactive mode visual indicator (border highlight, cursor change, badge state)
- Right-click context menu prevention
- Pointer capture for drag-out-of-frame scenarios

**Addresses:** Should-have features (click ripple, right-click prevention, interactive mode indicator)
**Avoids:** Pitfall 4 (stale frame clicks) with freshness indicator, Pitfall 8 (no visual feedback) with click overlay
**Implements:** Overlay layer pattern from PITFALLS.md architectural implications

### Phase 6: Input Coordination (Race Prevention)
**Rationale:** Deferred until basic input works because it requires agent-level integration. Even basic locking (reject user input during tool calls) prevents worst outcomes.

**Delivers:**
- Input state machine (IDLE, AGENT_ACTIVE, USER_ACTIVE) or basic lock
- "Agent busy" indicator during tool execution
- Queue or defer user input when agent is mid-action
- Optional: notify agent of page changes after user interaction

**Addresses:** v1.2 risk mitigation (race conditions acceptable with warning, full solution deferred)
**Avoids:** Pitfall 3 (race condition) with basic coordination, documenting limitations if full lock deferred
**Implements:** State machine pattern from PITFALLS.md prevention strategies

### Phase Ordering Rationale

- **Strict sequential order through Phase 2** — Interface extension → viewport metadata → server routing cannot be parallelized. Each is a prerequisite for the next.
- **Phases 3 and 4 can partially overlap** — Coordinate mapping (click) and keyboard handling share server routing but are otherwise independent. However, focus management logic in Phase 4 affects click behavior (click-to-activate), so sequential is safer.
- **Phase 5 is pure client UI polish** — Can proceed anytime after Phase 3 click works, no server dependencies.
- **Phase 6 requires cross-cutting changes** — Touches agent state, toolset execution, and UI state. Natural final phase when basic input is proven.

### Research Flags

Phases with well-documented patterns (skip `/gsd:research-phase`):
- **All phases** — CDP Input domain thoroughly documented, coordinate mapping has noVNC/remote-desktop precedent, WebSocket message patterns are standard JSON-over-WS, React event handling is vanilla DOM events. No niche domains or sparse documentation.

Research gaps addressed:
- **CDP event sequences** — Exact parameter requirements (button defaults, char event type) documented in PITFALLS.md from official CDP specs and Chromium bug tracker
- **Coordinate mapping with object-contain** — Complete formula provided with letterbox offset calculation, sourced from noVNC scaling issues
- **Race condition patterns** — Industry assist-mode convergence documented from Browserbase, AWS AgentCore, OpenAI Operator
- **Keyboard event mapping** — DOM KeyboardEvent to CDP dispatchKeyEvent mapping with modifier bitmask fully specified

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All infrastructure verified in codebase via file inspection. CDP APIs verified against official Chrome DevTools Protocol documentation. No new dependencies required. |
| Features | HIGH | Feature expectations converged across Browserbase Live View, AWS AgentCore, OpenAI Operator. Assist mode pattern is industry standard. Table stakes vs differentiators clearly separated. |
| Architecture | HIGH | Complete data flow documented with exact file locations and line numbers. Event sequences verified against CDP specification. Coordinate mapping formula validated against noVNC patterns. |
| Pitfalls | HIGH | Critical pitfalls sourced from CDP official docs, Chromium bug tracker, Puppeteer/Playwright community issues. Coordinate mapping pitfalls directly from noVNC issue tracker (scaling issue #12, position drift #258). |

**Overall confidence:** HIGH

### Gaps to Address

**Infrastructure gap validation during Phase 1:**
- Verify `BrowserToolsetLike` interface extension does not break existing consumers. Check all locations where `getToolset()` is called to ensure type compatibility.
- Test viewport metadata broadcast does not break existing clients. The JSON message has a new `viewport` field that must be distinguished from existing `status`, `url`, `error` fields.

**Coordinate mapping edge cases during Phase 3:**
- Handle zero-dimension frames (race condition between connect and first frame)
- Handle aspect ratio exactly matching container (no letterboxing, but division might produce NaN with floating-point errors)
- Validate clicks outside viewport bounds (return null and ignore, don't send to server)
- Test extreme panel sizes (very small, very large, portrait vs landscape)

**Keyboard event coverage during Phase 4:**
- Not all special keys documented with `windowsVirtualKeyCode`. May need to add mapping table for F1-F12, Home, End, PageUp, PageDown.
- Emoji and Unicode character input may not work with simple `char` event. Defer to v1.3 if encountered.

**Race condition coordination during Phase 6:**
- How to detect "agent is mid-tool-call" — may require agent state tracking not currently exposed
- Whether to buffer user input during agent action or simply block with visual indicator
- How to notify agent that page changed (could be automatic via snapshot invalidation or explicit signal)

## Sources

### Primary (HIGH confidence)
- **Codebase inspection:** `integrations/agent-browser/src/toolset.ts` (lines 273-302 inject methods), `packages/core/src/agent/types.ts` (BrowserToolsetLike interface), `packages/deployer/src/server/browser-stream/` (WebSocket handler, ViewerRegistry), `packages/playground-ui/src/domains/agents/` (BrowserViewFrame component, useBrowserStream hook)
- **Chrome DevTools Protocol:** [Input domain (tip-of-tree)](https://chromedevtools.github.io/devtools-protocol/tot/Input/) — dispatchMouseEvent, dispatchKeyEvent specifications with parameter defaults
- **CDP screencast metadata:** `integrations/agent-browser/src/screencast/types.ts` (ScreencastFrameData.viewport structure)

### Secondary (MEDIUM confidence)
- **Browserbase Live View:** [docs.browserbase.com](https://docs.browserbase.com/features/session-live-view) — Interactive embedding, VNC-based click/type/scroll patterns
- **AWS AgentCore Browser:** [AWS Bedrock AgentCore docs](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-tool.html) — DCV-powered live view with human takeover, assist mode pattern
- **OpenAI Operator:** [Introducing Operator](https://openai.com/index/introducing-operator/) — Takeover mode, user control handoff patterns
- **noVNC coordinate scaling:** [GitHub issue #12](https://github.com/novnc/noVNC/issues/12), [issue #258](https://github.com/novnc/noVNC/issues/258), [issue #1155](https://github.com/novnc/noVNC/issues/1155) — CSS scaling breaks mouse coordinates, position drift, letterboxing problems

### Tertiary (LOW confidence — patterns observed)
- **Remote desktop latency:** [Latency testing remote browsing](https://thume.ca/2022/05/15/latency-testing-streaming/) — Display streaming latency analysis, local cursor overlay techniques
- **Chromium bug tracker:** [Issue #40248189](https://issues.chromium.org/issues/40248189) — dispatchMouseEvent not accounting for emulation scale
- **CDP community issues:** [chromote issue #30](https://github.com/rstudio/chromote/issues/30) — dispatchMouseEvent hanging, [devtools-protocol issue #74](https://github.com/ChromeDevTools/devtools-protocol/issues/74) — modifiers not working
- **Playwright patterns:** [Playwright issue #3912](https://github.com/microsoft/playwright/issues/3912) — Race condition patterns in concurrent operations

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
