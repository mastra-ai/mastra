# Roadmap: v1.3 Browser View Layout

## Overview

Replace the floating browser overlay with a side-by-side split-pane layout so the browser view and chat are both visible without obstruction. Three phases: establish context infrastructure for session state sharing, migrate the browser panel into a collapsible split-pane layout, then harden interaction edge cases introduced by the new layout geometry.

## Milestones

- v1.0 MVP - Phases 1-6 (shipped 2026-01-27)
- v1.1 Live View - Phases 7-9 (shipped 2026-01-28)
- v1.2 Input Injection - Phases 10-15 (shipped 2026-01-30)
- v1.3 Browser View Layout - Phases 16-18 (in progress)

## Phases

- [x] **Phase 16: Context Infrastructure** - Session state context and provider hoisting for layout-level coordination
- [ ] **Phase 17: Split-Pane Layout** - Browser panel as collapsible side-by-side pane with auto-expand/collapse
- [ ] **Phase 18: Interaction Hardening** - Keyboard capture scoping, click-outside fixes, and coordinate recalculation

## Phase Details

### Phase 16: Context Infrastructure
**Goal**: Layout-level state sharing enables browser panel coordination without visual changes
**Depends on**: None (extends existing v1.2 infrastructure)
**Requirements**: STATE-01, STATE-02
**Success Criteria** (what must be TRUE):
  1. BrowserSessionContext provides isActive, status, and control methods (show/hide/setStatus) accessible from both AgentLayout and BrowserViewPanel
  2. BrowserToolCallsProvider wraps both Thread and BrowserViewPanel (hoisted to Agent page level), so tool call history renders in the browser panel and chat messages simultaneously
  3. All existing tests pass and zero visual changes occur -- the overlay still renders as before
**Plans**: 1 plan

Plans:
- [x] 16-01: BrowserSessionContext provider, BrowserToolCallsProvider hoisting, and Agent page wiring

---

### Phase 17: Split-Pane Layout
**Goal**: Users see chat and browser side-by-side with automatic show/hide and manual resize/collapse
**Depends on**: Phase 16 (needs BrowserSessionContext and hoisted providers)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, STATE-03
**Success Criteria** (what must be TRUE):
  1. When agent launches a browser session, the layout splits into chat on left and browser on right without user intervention
  2. When no browser session is active, chat occupies the full width with no visible browser panel or separator
  3. User can collapse the browser panel via a header button and chat reclaims full width
  4. User can drag the separator handle to resize the browser panel width
  5. BrowserViewFrame WebSocket connection stays alive through collapse/expand cycles (never unmounts)
**Plans**: TBD

Plans:
- [ ] 17-01: AgentLayout browserSlot, collapsible panel wiring, and BrowserViewPanel extraction from Thread
- [ ] 17-02: Auto-expand on session start, collapse on close, header button toggle

---

### Phase 18: Interaction Hardening
**Goal**: Input injection works correctly within the new split-pane geometry
**Depends on**: Phase 17 (needs split-pane layout in place)
**Requirements**: FIX-01, FIX-02, FIX-03
**Success Criteria** (what must be TRUE):
  1. Arrow keys and Tab on the panel separator work for keyboard-based resize (keyboard capture does not swallow them)
  2. Clicking the separator handle to resize does not exit interactive mode
  3. Clicking or scrolling in the browser panel immediately after a resize dispatches to the correct browser coordinates
**Plans**: TBD

Plans:
- [ ] 18-01: Scoped keyboard capture, separator exclusion from click-outside, and resize-aware coordinate mapping

---

## Progress

**Execution Order:** 16 -> 17 -> 18

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 16. Context Infrastructure | 1/1 | Complete | 2026-01-31 |
| 17. Split-Pane Layout | 0/2 | Not started | - |
| 18. Interaction Hardening | 0/1 | Not started | - |
