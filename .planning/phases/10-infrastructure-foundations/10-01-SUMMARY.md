---
phase: 10-infrastructure-foundations
plan: 01
subsystem: infra
tags: [cdp, websocket, viewport, input-injection, browser-stream, typescript-interfaces]

# Dependency graph
requires:
  - phase: 07-cdp-passthrough-injection
    provides: Concrete injectMouseEvent/injectKeyboardEvent methods on BrowserToolset
  - phase: 08-screencast-infrastructure
    provides: ViewerRegistry, WebSocket frame broadcasting, BrowserStreamConfig
provides:
  - BrowserToolsetLike interface with injectMouseEvent and injectKeyboardEvent
  - ClientInputMessage union type (MouseInputMessage | KeyboardInputMessage)
  - ViewportMessage type for server-to-client coordinate mapping
  - Viewport metadata broadcasting in ViewerRegistry on stream start and dimension change
affects:
  - 11-server-input-routing (uses BrowserToolsetLike inject methods and ClientInputMessage types)
  - 12-client-coordinate-mapping (uses ViewportMessage for coordinate scaling)
  - 13-focus-management-keyboard (uses KeyboardInputMessage type)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Change-detection broadcasting: broadcastViewportIfChanged mirrors broadcastUrlIfChanged pattern"
    - "Type-discriminated union: ClientInputMessage uses 'type' field for runtime switching"

key-files:
  created: []
  modified:
    - packages/core/src/agent/types.ts
    - packages/deployer/src/server/browser-stream/types.ts
    - packages/deployer/src/server/browser-stream/viewer-registry.ts

key-decisions:
  - "Viewport metadata sent as separate JSON message alongside raw base64 frames, not wrapped together"
  - "Change detection for viewport uses simple width/height equality check"
  - "ClientInputMessage discriminated by 'type' field (mouse/keyboard) with 'eventType' for CDP event subtype"

patterns-established:
  - "Separate JSON metadata messages: viewport, URL, and status sent as JSON; frames stay raw base64"
  - "Per-agent tracking maps: lastViewports follows same pattern as lastUrls for dedup"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 10 Plan 01: Infrastructure Foundations Summary

**BrowserToolsetLike interface extended with inject methods, ClientInputMessage union type defined, viewport metadata broadcasting wired into ViewerRegistry**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T15:22:34Z
- **Completed:** 2026-01-29T15:25:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended BrowserToolsetLike interface with injectMouseEvent() and injectKeyboardEvent() matching concrete BrowserToolset signatures
- Defined MouseInputMessage, KeyboardInputMessage, and ClientInputMessage discriminated union type for client-to-server input routing
- Defined ViewportMessage type for server-to-client viewport coordinate metadata
- Implemented viewport metadata broadcasting in ViewerRegistry with change detection (sends on first frame and dimension changes)
- Verified concrete BrowserToolset satisfies updated interface (TypeScript checks pass across core, deployer, and agent-browser)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BrowserToolsetLike interface and define ClientInputMessage types** - `4e7c20e4c8` (feat)
2. **Task 2: Implement viewport metadata broadcasting in ViewerRegistry** - `fe594533ad` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/core/src/agent/types.ts` - Added injectMouseEvent() and injectKeyboardEvent() to BrowserToolsetLike interface
- `packages/deployer/src/server/browser-stream/types.ts` - Added MouseInputMessage, KeyboardInputMessage, ClientInputMessage, and ViewportMessage types
- `packages/deployer/src/server/browser-stream/viewer-registry.ts` - Added viewport tracking, broadcastViewportIfChanged method, wired into frame handler, cleanup in removeViewer and closeBrowserSession

## Decisions Made
- Viewport metadata sent as separate JSON message (`{ viewport: { width, height } }`) alongside raw base64 frames -- keeps existing frame protocol unchanged
- Change detection uses simple width/height equality check on lastViewports map -- matches the existing broadcastUrlIfChanged pattern
- ClientInputMessage uses `type` field ('mouse' | 'keyboard') for discriminated union, with separate `eventType` field for CDP event subtypes -- clean separation between message routing and CDP passthrough

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three INFRA requirements (INFRA-01, INFRA-02, INFRA-03) are complete
- Phase 11 (Server Input Routing) can now use BrowserToolsetLike.injectMouseEvent/injectKeyboardEvent through the server
- Phase 12 (Client Coordinate Mapping) can now receive viewport dimensions via ViewportMessage
- Phase 13 (Focus Management) can use KeyboardInputMessage type for keyboard event routing
- No blockers or concerns

---
*Phase: 10-infrastructure-foundations*
*Completed: 2026-01-29*
