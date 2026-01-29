# Roadmap: Mastra Browser Tools

## Milestones

- [x] **v1.0 Browser Toolset** - Phases 1-6 (shipped 2026-01-27)
- [x] **v1.1 Browser Live View** - Phases 7-9 (shipped 2026-01-28)
- [ ] **v1.2 Browser Input Injection** - Phases 10-15

## Phases

<details>
<summary>v1.0 Browser Toolset (Phases 1-6) - SHIPPED 2026-01-27</summary>

### Phase 1: Infrastructure Setup
**Goal**: Project scaffolding with build, test, and type infrastructure
**Plans**: 2 plans

Plans:
- [x] 01-01: Package structure and build configuration
- [x] 01-02: Test infrastructure and CI setup

### Phase 2: Core Actions
**Goal**: Core browser interaction tools (navigate, snapshot, click, type, scroll)
**Plans**: 3 plans

Plans:
- [x] 02-01: Navigate and snapshot tools
- [x] 02-02: Click and type tools
- [x] 02-03: Scroll tool

### Phase 3: Screenshot
**Goal**: Visual capture tool for agent documentation
**Plans**: 1 plan

Plans:
- [x] 03-01: Screenshot tool with viewport/full-page/element modes

### Phase 4: Navigate Error Consistency
**Goal**: Unified error handling across all tools
**Plans**: 1 plan

Plans:
- [x] 04-01: BrowserToolError unification

### Phase 5: Schema Consolidation
**Goal**: Single source of truth for tool schemas
**Plans**: 2 plans

Plans:
- [x] 05-01: Types.ts as schema source
- [x] 05-02: Schema migration and validation

### Phase 6: Browser Lifecycle Locking
**Goal**: Thread-safe browser initialization
**Plans**: 1 plan

Plans:
- [x] 06-01: Singleton Promise pattern for getBrowser

</details>

<details>
<summary>v1.1 Browser Live View (Phases 7-9) - SHIPPED 2026-01-28</summary>

### Phase 7: Screencast API
**Goal**: BrowserToolset exposes methods to control CDP screencast capture and input injection
**Plans**: 1 plan

Plans:
- [x] 07-01: Screencast types, ScreencastStream class, and BrowserToolset integration

### Phase 8: Transport Layer
**Goal**: WebSocket server endpoint relays screencast frames to connected Studio clients
**Plans**: 2 plans

Plans:
- [x] 08-01: Browser-stream module with types, ViewerRegistry, and WebSocket route setup
- [x] 08-02: Server integration with deployer createNodeServer

### Phase 9: Studio UI
**Goal**: BrowserViewPanel component renders live screencast inline with agent chat
**Plans**: 2 plans

Plans:
- [x] 09-01: useBrowserStream hook with BrowserViewFrame and BrowserViewHeader components
- [x] 09-02: BrowserViewPanel assembly and AgentLayout browserSlot integration

</details>

### Phase 10: Infrastructure Foundations
**Goal**: Interface extensions and viewport metadata delivery enable input routing

**Dependencies**: None (extends existing Phase 7-9 infrastructure)

**Requirements**: INFRA-01, INFRA-02, INFRA-03

**Success Criteria**:
1. `BrowserToolsetLike` interface includes `injectMouseEvent()` and `injectKeyboardEvent()` signatures matching concrete `BrowserToolset` implementation
2. Server broadcasts viewport metadata (width, height) to clients on stream start and when dimensions change
3. `ClientInputMessage` union type defined with MouseInputMessage and KeyboardInputMessage discriminated by type field
4. Existing raw base64 frame protocol unchanged (metadata sent separately, not embedded in frame)

**Plans**: 1 plan

Plans:
- [x] 10-01: Interface extensions, input message types, and viewport metadata broadcasting

---

### Phase 11: Server Input Routing
**Goal**: WebSocket message handler routes user input to CDP injection methods

**Dependencies**: Phase 10 (needs BrowserToolsetLike extension and ClientInputMessage types)

**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03

**Success Criteria**:
1. Server `onMessage` handler parses JSON input messages and switches on type field to route to toolset inject methods
2. Malformed input messages are silently ignored with no acknowledgment (fire-and-forget pattern)
3. Mouse input messages call `BrowserToolset.injectMouseEvent()` with complete 3-event sequence (mouseMoved -> mousePressed -> mouseReleased)
4. Keyboard input messages call `BrowserToolset.injectKeyboardEvent()` with appropriate sequences (3-event for printable, 2-event for special keys)
5. Server validates message structure before routing (required fields present, coordinates in range if available)

**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md -- Input handler module with validation, routing, and onMessage wiring

---

### Phase 12: Client Coordinate Mapping and Click
**Goal**: User can click and scroll in the live view frame with accurate coordinate mapping

**Dependencies**: Phase 10 (needs viewport metadata), Phase 11 (needs server routing)

**Requirements**: CLICK-01, CLICK-02, CLICK-03, CLICK-04, CLICK-05, CLICK-06, SCROLL-01, SCROLL-02, VIS-03

**Success Criteria**:
1. User clicks on live view frame and click is dispatched to correct browser element accounting for object-contain letterboxing
2. Coordinate mapping function is pure (viewport coordinates = letterbox offset + scaled position) with no growing error from center to corners
3. Clicks in letterbox regions (black bars from aspect ratio mismatch) are ignored and not sent to server
4. Right-clicks are forwarded to browser instead of showing host context menu
5. Modifier keys (Ctrl, Shift, Alt, Meta) captured from event and forwarded as CDP bitmask
6. Mouse wheel events dispatched as CDP mouseWheel with delta normalized across browsers and clamped to prevent extreme jumps
7. mouseMoved events throttled to max 30/sec using requestAnimationFrame to prevent WebSocket flood

**Plans**: TBD

---

### Phase 13: Focus Management and Keyboard
**Goal**: User can type in the live view without keyboard events leaking to host page

**Dependencies**: Phase 11 (needs server routing)

**Requirements**: KEY-01, KEY-02, KEY-03, KEY-04, FOCUS-01, FOCUS-02, FOCUS-03

**Success Criteria**:
1. Live view panel requires explicit click on frame to enter interactive mode (keyboard capture activated)
2. Printable characters use 3-event CDP sequence (keyDown -> char with text -> keyUp) to insert text in browser input fields
3. Non-printable keys (Enter, Escape, Tab, arrows, Backspace) use 2-event sequence (keyDown -> keyUp)
4. Modifier key state tracked across key events and included in CDP event bitmask
5. Pressing Escape or clicking outside panel exits interactive mode (keyboard capture released)
6. Keyboard events do NOT leak to host page (chat input, Studio shortcuts) when panel is focused

**Plans**: TBD

---

### Phase 14: Visual Feedback and Polish
**Goal**: User receives immediate visual confirmation for input actions despite frame latency

**Dependencies**: Phase 12 (needs click working)

**Requirements**: VIS-01, VIS-02

**Success Criteria**:
1. Interactive mode indicator visible when panel is accepting input (border highlight, cursor change, or badge state change)
2. Click ripple effect appears immediately at click position before browser responds (CSS animation overlay)
3. Ripple effect positions correctly accounting for letterbox offset (same coordinate mapping as actual click)

**Plans**: TBD

---

### Phase 15: Input Coordination
**Goal**: User input and agent tool calls coexist without destructive race conditions

**Dependencies**: Phases 10-14 (all prior phases must complete)

**Requirements**: COORD-01, COORD-02, COORD-03

**Success Criteria**:
1. Input state tracking distinguishes IDLE, AGENT_ACTIVE, and USER_ACTIVE periods
2. Visual indicator shows when agent is executing a tool call (agent busy state)
3. User input during agent tool execution is handled gracefully (queued, blocked with warning, or limitations documented)
4. No destructive races between user clicks and agent tool calls (stale refs, double actions, element invalidation)

**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 2/2 | Complete | 2026-01-26 |
| 2. Core Actions | v1.0 | 3/3 | Complete | 2026-01-26 |
| 3. Screenshot | v1.0 | 1/1 | Complete | 2026-01-26 |
| 4. Error Consistency | v1.0 | 1/1 | Complete | 2026-01-27 |
| 5. Schema Consolidation | v1.0 | 2/2 | Complete | 2026-01-27 |
| 6. Lifecycle Locking | v1.0 | 1/1 | Complete | 2026-01-27 |
| 7. Screencast API | v1.1 | 1/1 | Complete | 2026-01-27 |
| 8. Transport Layer | v1.1 | 2/2 | Complete | 2026-01-27 |
| 9. Studio UI | v1.1 | 2/2 | Complete | 2026-01-28 |
| 10. Infrastructure Foundations | v1.2 | 1/1 | Complete | 2026-01-29 |
| 11. Server Input Routing | v1.2 | 0/1 | Not Started | -- |
| 12. Client Mapping & Click | v1.2 | 0/TBD | Not Started | -- |
| 13. Focus & Keyboard | v1.2 | 0/TBD | Not Started | -- |
| 14. Visual Feedback | v1.2 | 0/TBD | Not Started | -- |
| 15. Input Coordination | v1.2 | 0/TBD | Not Started | -- |

---
*Roadmap created: 2026-01-27*
*Last updated: 2026-01-29 -- Phase 11 planned*
