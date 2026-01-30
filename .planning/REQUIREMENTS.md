# Requirements: v1.2 Browser Input Injection

Requirements for Browser Input Injection milestone. Each maps to roadmap phases.

## Infrastructure

- [x] **INFRA-01**: `BrowserToolsetLike` interface includes `injectMouseEvent()` and `injectKeyboardEvent()` signatures matching concrete `BrowserToolset` implementation
- [x] **INFRA-02**: Server broadcasts viewport metadata (width, height) to connected clients on stream start and dimension changes
- [x] **INFRA-03**: `ClientInputMessage` union type defined for client-to-server WebSocket messages (MouseInputMessage | KeyboardInputMessage)

## Server Input Routing

- [x] **ROUTE-01**: Server `onMessage` handler parses JSON input messages and routes to `BrowserToolset.injectMouseEvent()` or `injectKeyboardEvent()` based on message type
- [x] **ROUTE-02**: Server validates input message structure before injection (silently ignores malformed messages)
- [x] **ROUTE-03**: Input injection is fire-and-forget (no acknowledgment latency)

## Click Forwarding

- [x] **CLICK-01**: User clicks on live view frame and click is dispatched to the corresponding browser viewport position via CDP `Input.dispatchMouseEvent`
- [x] **CLICK-02**: Coordinate mapping translates scaled `<img>` element clicks to browser viewport CSS pixels, accounting for `object-contain` letterboxing
- [x] **CLICK-03**: Clicks in letterbox regions (black bars from aspect ratio mismatch) are ignored
- [x] **CLICK-04**: CDP click uses complete event sequence (mouseMoved → mousePressed → mouseReleased) with explicit `button:'left'` and `clickCount:1`
- [x] **CLICK-05**: Modifier keys (Ctrl, Shift, Alt, Meta) are captured and forwarded as CDP bitmask
- [x] **CLICK-06**: Right-clicks are forwarded to browser instead of showing host context menu

## Keyboard Forwarding

- [x] **KEY-01**: User keystrokes are forwarded to browser when live view panel is focused
- [x] **KEY-02**: Printable characters use 3-event CDP sequence (keyDown → char → keyUp) for text insertion
- [x] **KEY-03**: Non-printable keys (Enter, Escape, Tab, arrows, Backspace) use 2-event sequence (keyDown → keyUp)
- [x] **KEY-04**: Modifier key state tracked and included in keyboard event bitmask

## Scroll Forwarding

- [x] **SCROLL-01**: User mouse wheel events dispatched as CDP `mouseWheel` events at mapped viewport coordinates
- [x] **SCROLL-02**: Scroll delta values normalized across browsers (deltaMode handling) and clamped to prevent extreme jumps

## Focus Management

- [x] **FOCUS-01**: Live view panel requires explicit click to enter interactive mode (keyboard events captured)
- [x] **FOCUS-02**: Clicking outside the panel or pressing Escape exits interactive mode
- [x] **FOCUS-03**: Keyboard events do NOT leak to host page (chat input, Studio shortcuts) when panel is focused

## Visual Feedback

- [x] **VIS-01**: Interactive mode indicator shows when panel is accepting input (border highlight, cursor change, or badge state)
- [x] **VIS-02**: Click ripple effect provides immediate visual confirmation at click position before browser responds
- [x] **VIS-03**: mouseMoved events throttled (requestAnimationFrame gating, max ~30/sec) to prevent WebSocket/CDP flood

## Input Coordination

- [x] **COORD-01**: Basic input state tracking distinguishes agent-active vs user-active periods
- [x] **COORD-02**: Visual indicator shows when agent is executing a tool call ("agent busy" state)
- [x] **COORD-03**: User input during agent tool execution is handled gracefully (queued, warned, or documented limitation)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 10 | Complete |
| INFRA-02 | Phase 10 | Complete |
| INFRA-03 | Phase 10 | Complete |
| ROUTE-01 | Phase 11 | Complete |
| ROUTE-02 | Phase 11 | Complete |
| ROUTE-03 | Phase 11 | Complete |
| CLICK-01 | Phase 12 | Complete |
| CLICK-02 | Phase 12 | Complete |
| CLICK-03 | Phase 12 | Complete |
| CLICK-04 | Phase 12 | Complete |
| CLICK-05 | Phase 12 | Complete |
| CLICK-06 | Phase 12 | Complete |
| KEY-01 | Phase 13 | Complete |
| KEY-02 | Phase 13 | Complete |
| KEY-03 | Phase 13 | Complete |
| KEY-04 | Phase 13 | Complete |
| SCROLL-01 | Phase 12 | Complete |
| SCROLL-02 | Phase 12 | Complete |
| FOCUS-01 | Phase 13 | Complete |
| FOCUS-02 | Phase 13 | Complete |
| FOCUS-03 | Phase 13 | Complete |
| VIS-01 | Phase 14 | Complete |
| VIS-02 | Phase 14 | Complete |
| VIS-03 | Phase 12 | Complete |
| COORD-01 | Phase 15 | Complete |
| COORD-02 | Phase 15 | Complete |
| COORD-03 | Phase 15 | Complete |

**Coverage:**
- v1.2 requirements: 27 total
- Infrastructure: 3
- Server routing: 3
- Click forwarding: 6
- Keyboard forwarding: 4
- Scroll forwarding: 2
- Focus management: 3
- Visual feedback: 3
- Input coordination: 3

---
*Created: 2026-01-28 for v1.2 Browser Input Injection milestone*
