# Requirements: v1.3 Browser View Layout

Requirements for Browser View Layout milestone. Each maps to roadmap phases.

## Layout

- [ ] **LAYOUT-01**: Browser view renders in a side-by-side split-pane with chat on left and browser on right
- [ ] **LAYOUT-02**: Browser panel is hidden entirely when no browser session is active (chat gets full width)
- [ ] **LAYOUT-03**: Browser panel auto-expands when agent launches a browser session
- [ ] **LAYOUT-04**: User can collapse the browser panel via header button to reclaim full chat width
- [ ] **LAYOUT-05**: User can resize the browser panel by dragging the separator handle

## State Management

- [ ] **STATE-01**: BrowserSessionContext created to share browser session visibility/status between BrowserViewPanel and AgentLayout
- [ ] **STATE-02**: BrowserToolCallsProvider hoisted from inside Thread to Agent page level (above both Thread and BrowserViewPanel)
- [ ] **STATE-03**: BrowserViewFrame never unmounts during collapse/expand (WebSocket connection preserved via collapsible panel with collapsedSize=0)

## Interaction Fixes

- [ ] **FIX-01**: Keyboard capture scoped to browser container element (not document-level capture phase) to prevent conflicts with panel resize keyboard navigation
- [ ] **FIX-02**: Click-outside handler excludes panel separator elements from triggering interactive mode exit
- [ ] **FIX-03**: Coordinate mapping recalculates when browser panel is resized (container dimensions change)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 17 | Pending |
| LAYOUT-02 | Phase 17 | Pending |
| LAYOUT-03 | Phase 17 | Pending |
| LAYOUT-04 | Phase 17 | Pending |
| LAYOUT-05 | Phase 17 | Pending |
| STATE-01 | Phase 16 | Pending |
| STATE-02 | Phase 16 | Pending |
| STATE-03 | Phase 17 | Pending |
| FIX-01 | Phase 18 | Pending |
| FIX-02 | Phase 18 | Pending |
| FIX-03 | Phase 18 | Pending |

**Coverage:**
- v1.3 requirements: 11 total (11 mapped, 0 orphans)
- Phase 16: 2 requirements (STATE-01, STATE-02)
- Phase 17: 6 requirements (LAYOUT-01 through LAYOUT-05, STATE-03)
- Phase 18: 3 requirements (FIX-01, FIX-02, FIX-03)

---
*Created: 2026-01-30 for v1.3 Browser View Layout milestone*
