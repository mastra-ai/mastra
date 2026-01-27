# Requirements: Mastra Browser Tools

**Defined:** 2026-01-27
**Core Value:** Users can watch browser agents work in real-time from within Mastra Studio

## v1.1 Requirements

Requirements for Browser Live View milestone. Each maps to roadmap phases.

### Screencast API

- [ ] **CAST-01**: BrowserToolset exposes `startScreencast()` method that begins CDP frame capture
- [ ] **CAST-02**: BrowserToolset exposes `stopScreencast()` method that ends frame capture
- [ ] **CAST-03**: Screencast sends CDP `screencastFrameAck` for each frame to prevent memory exhaustion
- [ ] **CAST-04**: BrowserToolset exposes `injectMouseEvent()` passthrough for future input injection
- [ ] **CAST-05**: BrowserToolset exposes `injectKeyboardEvent()` passthrough for future input injection

### Transport Layer

- [ ] **XPORT-01**: WebSocket endpoint exists at `/browser/:agentId/stream` for frame delivery
- [ ] **XPORT-02**: WebSocket handler relays CDP frames to connected clients
- [ ] **XPORT-03**: WebSocket connections are properly cleaned up on disconnect
- [ ] **XPORT-04**: Screencast only runs when at least one viewer is connected

### Studio UI

- [ ] **UI-01**: BrowserViewPanel component renders screencast frames inline with agent chat
- [ ] **UI-02**: Component uses `useRef` pattern to avoid virtual DOM thrashing
- [ ] **UI-03**: Connection status indicator shows connected/connecting/disconnected states
- [ ] **UI-04**: Empty state shown when no browser is active
- [ ] **UI-05**: Loading state shown during browser initialization

## Future Requirements

Deferred to v1.5 or later. Tracked but not in current roadmap.

### Enhanced Display

- **DISP-01**: Current URL displayed in browser view header
- **DISP-02**: Page title displayed in browser view header
- **DISP-03**: Resize/zoom controls for browser view
- **DISP-04**: Action overlay showing what element was clicked/typed

### User Interaction

- **INTERACT-01**: User can click elements in browser view to forward clicks
- **INTERACT-02**: User can type in browser view to forward keyboard input
- **INTERACT-03**: User can scroll browser view to control viewport

### Recording

- **REC-01**: Session recording captures all frames for playback
- **REC-02**: Timeline scrubbing for recorded sessions
- **REC-03**: Session export to video file

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-tab view | Complexity; single active tab sufficient for v1 |
| Picture-in-picture | Nice-to-have, not core to live view value |
| Offline viewing | Requires recording infrastructure |
| Frame rate controls | Use sensible defaults, defer tuning UI |
| Multi-viewer sync | Single viewer assumed; add if needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAST-01 | Phase 7 | Pending |
| CAST-02 | Phase 7 | Pending |
| CAST-03 | Phase 7 | Pending |
| CAST-04 | Phase 7 | Pending |
| CAST-05 | Phase 7 | Pending |
| XPORT-01 | Phase 8 | Pending |
| XPORT-02 | Phase 8 | Pending |
| XPORT-03 | Phase 8 | Pending |
| XPORT-04 | Phase 8 | Pending |
| UI-01 | Phase 9 | Pending |
| UI-02 | Phase 9 | Pending |
| UI-03 | Phase 9 | Pending |
| UI-04 | Phase 9 | Pending |
| UI-05 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 after roadmap creation*
