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

- [ ] **CLICK-01**: User clicks on live view frame and click is dispatched to the corresponding browser viewport position via CDP `Input.dispatchMouseEvent`
- [ ] **CLICK-02**: Coordinate mapping translates scaled `<img>` element clicks to browser viewport CSS pixels, accounting for `object-contain` letterboxing
- [ ] **CLICK-03**: Clicks in letterbox regions (black bars from aspect ratio mismatch) are ignored
- [ ] **CLICK-04**: CDP click uses complete event sequence (mouseMoved → mousePressed → mouseReleased) with explicit `button:'left'` and `clickCount:1`
- [ ] **CLICK-05**: Modifier keys (Ctrl, Shift, Alt, Meta) are captured and forwarded as CDP bitmask
- [ ] **CLICK-06**: Right-clicks are forwarded to browser instead of showing host context menu

## Keyboard Forwarding

- [ ] **KEY-01**: User keystrokes are forwarded to browser when live view panel is focused
- [ ] **KEY-02**: Printable characters use 3-event CDP sequence (keyDown → char → keyUp) for text insertion
- [ ] **KEY-03**: Non-printable keys (Enter, Escape, Tab, arrows, Backspace) use 2-event sequence (keyDown → keyUp)
- [ ] **KEY-04**: Modifier key state tracked and included in keyboard event bitmask

## Scroll Forwarding

- [ ] **SCROLL-01**: User mouse wheel events dispatched as CDP `mouseWheel` events at mapped viewport coordinates
- [ ] **SCROLL-02**: Scroll delta values normalized across browsers (deltaMode handling) and clamped to prevent extreme jumps

## Focus Management

- [ ] **FOCUS-01**: Live view panel requires explicit click to enter interactive mode (keyboard events captured)
- [ ] **FOCUS-02**: Clicking outside the panel or pressing Escape exits interactive mode
- [ ] **FOCUS-03**: Keyboard events do NOT leak to host page (chat input, Studio shortcuts) when panel is focused

## Visual Feedback

- [ ] **VIS-01**: Interactive mode indicator shows when panel is accepting input (border highlight, cursor change, or badge state)
- [ ] **VIS-02**: Click ripple effect provides immediate visual confirmation at click position before browser responds
- [ ] **VIS-03**: mouseMoved events throttled (requestAnimationFrame gating, max ~30/sec) to prevent WebSocket/CDP flood

## Input Coordination

- [ ] **COORD-01**: Basic input state tracking distinguishes agent-active vs user-active periods
- [ ] **COORD-02**: Visual indicator shows when agent is executing a tool call ("agent busy" state)
- [ ] **COORD-03**: User input during agent tool execution is handled gracefully (queued, warned, or documented limitation)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 10 | Complete |
| INFRA-02 | Phase 10 | Complete |
| INFRA-03 | Phase 10 | Complete |
| ROUTE-01 | Phase 11 | Complete |
| ROUTE-02 | Phase 11 | Complete |
| ROUTE-03 | Phase 11 | Complete |
| CLICK-01 | Phase 12 | Pending |
| CLICK-02 | Phase 12 | Pending |
| CLICK-03 | Phase 12 | Pending |
| CLICK-04 | Phase 12 | Pending |
| CLICK-05 | Phase 12 | Pending |
| CLICK-06 | Phase 12 | Pending |
| KEY-01 | Phase 13 | Pending |
| KEY-02 | Phase 13 | Pending |
| KEY-03 | Phase 13 | Pending |
| KEY-04 | Phase 13 | Pending |
| SCROLL-01 | Phase 12 | Pending |
| SCROLL-02 | Phase 12 | Pending |
| FOCUS-01 | Phase 13 | Pending |
| FOCUS-02 | Phase 13 | Pending |
| FOCUS-03 | Phase 13 | Pending |
| VIS-01 | Phase 14 | Pending |
| VIS-02 | Phase 14 | Pending |
| VIS-03 | Phase 12 | Pending |
| COORD-01 | Phase 15 | Pending |
| COORD-02 | Phase 15 | Pending |
| COORD-03 | Phase 15 | Pending |

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
