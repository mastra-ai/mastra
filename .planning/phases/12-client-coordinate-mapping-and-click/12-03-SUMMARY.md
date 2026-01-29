---
phase: 12-client-coordinate-mapping-and-click
plan: 03
subsystem: ui
tags: [react, cdp, mouse-events, coordinate-mapping, websocket, requestAnimationFrame]

# Dependency graph
requires:
  - phase: 12-01
    provides: mapClientToViewport, normalizeWheelDelta, getModifiers pure utilities
  - phase: 12-02
    provides: viewport state and sendMessage callback from useBrowserStream
  - phase: 11-01
    provides: Server-side input handler that receives MouseInputMessage JSON and dispatches to CDP
provides:
  - useMouseInteraction React hook composing click, scroll, right-click, and mouse move into CDP messages
  - BrowserViewFrame wired with mouse interaction (interactive when streaming)
  - Full client-side mouse input pipeline from DOM events to WebSocket CDP messages
affects: [14-visual-feedback-and-polish, 15-input-coordination]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Side-effect-only React hook with no return value"
    - "Ref-based closure freshness for stable event listeners"
    - "requestAnimationFrame throttling for mouse move at 30fps"
    - "Passive false wheel listener for preventDefault"

key-files:
  created:
    - packages/playground-ui/src/domains/agents/hooks/use-mouse-interaction.ts
  modified:
    - packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx

key-decisions:
  - "viewport and sendMessage stored in refs to avoid listener re-attachment on every render"
  - "rAF throttle at 30fps for mouse move (FRAME_INTERVAL = 1000/30)"
  - "CDP click sequence: mouseMoved then mousePressed (moved first for hover state)"
  - "Mouse interaction enabled only when status === 'streaming'"

patterns-established:
  - "Side-effect hook: useMouseInteraction has void return, attaches/detaches DOM listeners via useEffect"
  - "Ref freshness pattern: mutable values (viewport, sendMessage) in refs, structural deps (enabled, imgRef) in useEffect deps"
  - "CDP message shape constructed inline as Record<string,unknown> -- no server type imports"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 12 Plan 03: Mouse Interaction Hook and BrowserViewFrame Wiring Summary

**useMouseInteraction hook composes click/scroll/right-click/mousemove into CDP messages sent over WebSocket, wired into BrowserViewFrame with streaming-only activation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T20:47:11Z
- **Completed:** 2026-01-29T20:49:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created useMouseInteraction hook handling all five mouse event types (mousedown, mouseup, contextmenu, wheel, mousemove)
- Click sequence sends CDP mouseMoved followed by mousePressed/mouseReleased with correct button mapping
- Right-clicks forwarded to browser with host context menu suppressed via preventDefault
- Wheel events normalized across browser deltaMode differences, clamped to 500px max
- Mouse moves throttled to 30fps via requestAnimationFrame (not lodash)
- Modifier keys (Alt/Ctrl/Meta/Shift) included as CDP bitmask in all events
- BrowserViewFrame wired with mouse interaction, active only during streaming state
- Cursor changes to pointer when streaming to indicate interactivity

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useMouseInteraction hook** - `1395166151` (feat)
2. **Task 2: Wire useMouseInteraction into BrowserViewFrame** - `17fce691bb` (feat)

## Files Created/Modified
- `packages/playground-ui/src/domains/agents/hooks/use-mouse-interaction.ts` - Side-effect React hook that attaches mouse/wheel/contextmenu listeners to img element and sends CDP input messages via WebSocket
- `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` - Destructures viewport/sendMessage from useBrowserStream, calls useMouseInteraction, adds cursor-pointer styling

## Decisions Made
- **Ref-based closure freshness:** viewport and sendMessage stored in useRef and synced via separate useEffects, so event handlers always read current values without causing listener re-attachment on every render cycle
- **rAF throttle at 30fps:** FRAME_INTERVAL = 1000/30 (~33.33ms) chosen as reasonable balance between responsiveness and network overhead; requestAnimationFrame provides natural frame-aligned scheduling
- **CDP click sequence:** mouseMoved sent before mousePressed to ensure the browser processes hover state before the click lands (matching real user behavior)
- **Streaming-only activation:** enabled = status === 'streaming' prevents mouse interaction during connecting/loading/error states when coordinate mapping would be meaningless
- **No server type imports:** CDP message shape constructed as Record<string,unknown> inline to avoid cross-package dependency between playground-ui and deployer packages

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Phase 12 is now COMPLETE: all three plans (coordinate math, WebSocket extensions, mouse interaction hook) shipped
- Full mouse input pipeline operational: DOM events -> useMouseInteraction -> mapClientToViewport -> sendMessage -> WebSocket -> server handleInputMessage -> CDP injectMouseEvent
- Phase 13 (Focus Management and Keyboard) can proceed -- depends on Phase 11 (complete), independent of Phase 12
- Phase 14 (Visual Feedback and Polish) can proceed -- depends on Phase 12 (now complete)
- Phase 15 (Input Coordination) blocked on Phases 13 and 14

---
*Phase: 12-client-coordinate-mapping-and-click*
*Completed: 2026-01-29*
