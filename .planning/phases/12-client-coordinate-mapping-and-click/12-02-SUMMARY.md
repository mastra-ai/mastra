---
phase: 12-client-coordinate-mapping-and-click
plan: 02
subsystem: ui
tags: [react-hooks, websocket, viewport, state-management, browser-stream]

# Dependency graph
requires:
  - phase: 10-infrastructure-foundations
    provides: ViewportMessage type and viewport broadcasting from ViewerRegistry
  - phase: 08-screencast-infrastructure
    provides: useBrowserStream hook with WebSocket frame streaming
provides:
  - viewport state in useBrowserStream (null initially, set from ViewportMessage JSON)
  - sendMessage callback in useBrowserStream (stable ref-based WebSocket write)
affects:
  - 12-client-coordinate-mapping-and-click (Plan 03 useMouseInteraction uses viewport and sendMessage)
  - 13-focus-management-keyboard (useKeyboardInteraction will use sendMessage)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable ref-based callback: sendMessage uses useCallback with empty deps and wsRef for WebSocket writes"
    - "Additive return type extension: new fields added to hook return without breaking existing consumers"

key-files:
  created: []
  modified:
    - packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts

key-decisions:
  - "sendMessage uses empty dependency array because wsRef is a stable ref -- no re-creation on re-render"
  - "viewport reset to null on disconnect to prevent stale dimensions on reconnect"
  - "viewport parsing at same level as url check (not inside status block) since ViewportMessage has no status field"

patterns-established:
  - "Hook return extension: additive fields on return interface, existing destructuring consumers unaffected"
  - "Ref-based WebSocket write: sendMessage stable across renders via useCallback + wsRef"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 12 Plan 02: useBrowserStream Viewport Extension Summary

**useBrowserStream extended with viewport state parsed from ViewportMessage JSON and stable sendMessage callback for downstream input injection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T20:42:12Z
- **Completed:** 2026-01-29T20:44:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added viewport state to useBrowserStream, initialized to null and populated when server sends `{ viewport: { width, height } }` JSON
- Created stable sendMessage callback using useCallback with empty deps array and wsRef for WebSocket writes
- Extended UseBrowserStreamReturn interface with viewport and sendMessage fields
- Viewport automatically reset to null on disconnect to prevent stale dimensions
- Existing consumers (BrowserViewFrame) compile without changes -- additive return type extension

## Task Commits

Each task was committed atomically:

1. **Task 1: Add viewport state and sendMessage to useBrowserStream** - `62dbee388a` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts` - Added viewport state, sendMessage callback, ViewportMessage parsing, viewport reset on disconnect, extended return type

## Decisions Made
- sendMessage uses empty dependency array because wsRef is a React ref with stable identity across renders -- no unnecessary re-creation
- Viewport reset to null on disconnect to prevent stale dimensions being used on reconnect with potentially different viewport
- Viewport parsing placed at same level as url check (not inside `if (parsed.status)` block) because ViewportMessage from ViewerRegistry has no status field -- it is a separate JSON message type

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useBrowserStream now provides viewport dimensions and sendMessage needed by Plan 03 (useMouseInteraction hook)
- useMouseInteraction can import viewport for coordinate mapping and sendMessage for sending MouseInputMessage JSON
- Phase 13 (Focus Management) can also use sendMessage for keyboard event injection
- No blockers or concerns

---
*Phase: 12-client-coordinate-mapping-and-click*
*Completed: 2026-01-29*
