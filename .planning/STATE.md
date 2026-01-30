# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** Agents can browse real websites and users can watch and assist them in real-time
**Current focus:** v1.2 Browser Input Injection (Phase 13+)

## Current Position

Phase: 13 - Focus Management and Keyboard
Plan: 01 of 02
Status: In progress
Last activity: 2026-01-30 -- Completed 13-01-PLAN.md

Progress: [████████████░░░░░░░░] 58% (4/7 plans in v1.2)

## Performance Metrics

**v1.0 Milestone:**
- Total plans completed: 10
- Phases: 6

**v1.1 Milestone:**
- Total plans completed: 5
- Phases: 3 (7, 8, 9)

**v1.2 Milestone:**
- Total plans completed: 6
- Phases: 6 (10-15)
- Requirements: 27

## Accumulated Context

### Decisions

All prior decisions documented in PROJECT.md Key Decisions table (19 entries).

Key infrastructure for v1.2:
- injectMouseEvent() and injectKeyboardEvent() exist as CDP passthroughs (Phase 7)
- WebSocket is bidirectional (Phase 8)
- BrowserViewPanel renders scaled frames with coordinate info (Phase 9)

Phase 10 decisions:
- Viewport metadata sent as separate JSON message alongside raw base64 frames (not wrapped)
- ClientInputMessage discriminated by `type` field (mouse/keyboard) with `eventType` for CDP subtypes
- Change detection for viewport uses simple width/height equality check

Phase 11 decisions:
- Type guard validation uses boolean return (not type predicates) due to Record<string,unknown> assignability
- No server-side rate limiting -- client responsible for throttling mouse moves
- No upper-bound coordinate validation -- CDP handles out-of-range gracefully

Phase 12 decisions:
- ModifierKeys interface accepts plain object (not MouseEvent/KeyboardEvent) for testability
- LINE_HEIGHT_PX = 16 for deltaMode 1 (DOM_DELTA_LINE) conversion
- MAX_DELTA = 500 clamping for wheel normalization
- Unknown deltaMode falls back to pixel passthrough
- sendMessage uses empty deps array (wsRef is stable ref identity)
- viewport reset to null on disconnect to prevent stale dimensions
- viewport parsing at same level as url check (ViewportMessage has no status field)
- viewport and sendMessage stored in refs to avoid listener re-attachment
- rAF throttle at 30fps for mouse move (FRAME_INTERVAL = 1000/30)
- CDP click sequence: mouseMoved then mousePressed (moved first for hover state)
- Mouse interaction enabled only when status === 'streaming'
- No server type imports -- CDP message shape constructed inline as Record<string,unknown>

Phase 13 decisions (Plan 01):
- Printable key detection via key.length === 1 (single Unicode codepoint)
- Escape consumed by hook (calls onEscape), never forwarded to remote browser
- IME guard uses both e.isComposing and e.keyCode === 229 for cross-browser compatibility
- compositionend uses bubble phase (not capture) -- standard DOM behavior
- Composed IME text sent as individual character sequences with modifiers=0

### Pending Todos

None.

### Blockers/Concerns

None.

## v1.2 Phase Structure

### Phase 10: Infrastructure Foundations
**Goal:** Interface extensions and viewport metadata delivery enable input routing
**Requirements:** INFRA-01, INFRA-02, INFRA-03 (3 total)
**Status:** Complete (10-01-SUMMARY.md)

### Phase 11: Server Input Routing
**Goal:** WebSocket message handler routes user input to CDP injection methods
**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03 (3 total)
**Status:** Complete (11-01-SUMMARY.md)
**Depends on:** Phase 10 (complete)

### Phase 12: Client Coordinate Mapping and Click
**Goal:** User can click and scroll in the live view frame with accurate coordinate mapping
**Requirements:** CLICK-01 through CLICK-06, SCROLL-01, SCROLL-02, VIS-03 (9 total)
**Status:** Complete (12-01, 12-02, 12-03 SUMMARY.md files)
**Depends on:** Phases 10 (complete), 11 (complete)

### Phase 13: Focus Management and Keyboard
**Goal:** User can type in the live view without keyboard events leaking to host page
**Requirements:** KEY-01 through KEY-04, FOCUS-01 through FOCUS-03 (7 total)
**Status:** In progress (Plan 01 complete, Plan 02 remaining)
**Depends on:** Phase 11 (complete)

### Phase 14: Visual Feedback and Polish
**Goal:** User receives immediate visual confirmation for input actions despite frame latency
**Requirements:** VIS-01, VIS-02 (2 total)
**Status:** Not Started
**Depends on:** Phase 12 (complete)

### Phase 15: Input Coordination
**Goal:** User input and agent tool calls coexist without destructive race conditions
**Requirements:** COORD-01, COORD-02, COORD-03 (3 total)
**Status:** Not Started
**Depends on:** Phases 10-14

## Milestone History

- v1.0: SHIPPED 2026-01-27 (6 phases, 10 plans) -- archived to milestones/
- v1.1: SHIPPED 2026-01-28 (3 phases, 5 plans) -- archived to milestones/

## Session Continuity

Last session: 2026-01-30T00:04:44Z
Stopped at: Completed 13-01-PLAN.md (key-mapping utility + keyboard interaction hook)
Resume file: None

**Next action:** Execute Phase 13 Plan 02 (interactive mode wiring) or Phase 14 (Visual Feedback and Polish).

**Context for next session:**
- Phase 13 Plan 01 complete: isPrintableKey utility and useKeyboardInteraction hook created
- Hook follows identical patterns as useMouseInteraction (refs, void return, capture phase, Record<string,unknown>)
- Plan 02 will add interactive mode state (click-to-focus, Escape-to-exit) and wire hook into BrowserViewFrame
- Phase 14 depends on Phase 12 (complete) -- can proceed in parallel
- Phase 15 blocked until Phases 13 and 14 complete
