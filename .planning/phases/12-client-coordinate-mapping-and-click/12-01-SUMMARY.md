---
phase: 12-client-coordinate-mapping-and-click
plan: 01
subsystem: ui
tags: [coordinate-mapping, object-fit-contain, wheel-normalization, cdp-bitmask, pure-functions]

# Dependency graph
requires:
  - phase: 10-infrastructure-foundations
    provides: ViewportDimensions type and viewport metadata delivery
  - phase: 11-server-input-routing
    provides: Server-side input handler that consumes mapped coordinates
provides:
  - mapClientToViewport pure function for object-fit:contain coordinate mapping
  - normalizeWheelDelta for cross-browser wheel delta normalization
  - getModifiers for JS event to CDP modifier bitmask conversion
  - ElementRect, ViewportDimensions, MappedCoordinates, ModifierKeys TypeScript interfaces
affects:
  - 12-02 (useBrowserStream viewport extension)
  - 12-03 (useMouseInteraction hook consumes all three functions)
  - 13-focus-management (getModifiers reusable for keyboard events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure utility functions with no DOM/React dependencies for testability"
    - "object-fit: contain coordinate mapping via scale + offset calculation"
    - "Cross-browser wheel delta normalization with mode-aware conversion and clamping"
    - "CDP modifier bitmask via bitwise OR composition"

key-files:
  created:
    - packages/playground-ui/src/domains/agents/utils/coordinate-mapping.ts
    - packages/playground-ui/src/domains/agents/utils/__tests__/coordinate-mapping.test.ts
  modified: []

key-decisions:
  - "ModifierKeys interface accepts plain object (not MouseEvent/KeyboardEvent) for testability and flexibility"
  - "LINE_HEIGHT_PX = 16 for deltaMode 1 conversion (standard approximation)"
  - "MAX_DELTA = 500 clamping constant for wheel normalization"
  - "Unknown deltaMode falls back to pixel behavior (passthrough)"

patterns-established:
  - "Pure coordinate math: ElementRect + ViewportDimensions -> MappedCoordinates | null"
  - "Wheel normalization: delta + deltaMode -> clamped pixels"
  - "CDP bitmask: Alt=1, Ctrl=2, Meta=4, Shift=8 via bitwise OR"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 12 Plan 01: Coordinate Mapping and Input Helpers Summary

**Pure coordinate mapping for object-fit:contain letterboxing, cross-browser wheel delta normalization, and CDP modifier bitmask conversion -- all tested with 28 vitest cases**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T20:37:44Z
- **Completed:** 2026-01-29T20:39:47Z
- **Tasks:** 2 (RED + GREEN; no REFACTOR needed)
- **Files modified:** 2

## Accomplishments
- mapClientToViewport correctly maps scaled img element clicks to browser viewport CSS pixels, accounting for letterbox and pillarbox offset
- Returns null for clicks landing in black bar regions (all four edges tested)
- normalizeWheelDelta handles deltaMode 0/1/2 with pixel/line/page conversion and [-500, 500] clamping
- getModifiers produces correct CDP bitmask for all modifier key combinations (Alt=1, Ctrl=2, Meta=4, Shift=8)
- 28 tests covering exact-fit, pillarbox, letterbox, null regions, corner accuracy, non-zero offset, fractional deltas, clamping extremes, and all modifier combinations

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for all three functions** - `4f70fd66de` (test)
2. **GREEN: Implementation of all three functions** - `4f53b72a66` (feat)

_No REFACTOR needed -- implementation was clean and minimal on first pass._

## Files Created/Modified
- `packages/playground-ui/src/domains/agents/utils/coordinate-mapping.ts` - Pure functions: mapClientToViewport, normalizeWheelDelta, getModifiers with TypeScript interfaces
- `packages/playground-ui/src/domains/agents/utils/__tests__/coordinate-mapping.test.ts` - 28 vitest cases covering all specified behavior

## Decisions Made
- ModifierKeys interface accepts a plain object with boolean flags rather than MouseEvent/KeyboardEvent -- keeps the function pure and testable without DOM types
- LINE_HEIGHT_PX set to 16 for deltaMode 1 (DOM_DELTA_LINE) conversion, which is the standard CSS line-height approximation
- Unknown deltaMode values fall back to pixel passthrough (same as deltaMode 0) rather than throwing
- MAX_DELTA clamping at 500 prevents extreme scroll jumps from page-mode or high-precision trackpad events

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- coordinate-mapping.ts is ready for import by use-mouse-interaction.ts (Plan 03)
- Import path: `import { mapClientToViewport, normalizeWheelDelta, getModifiers } from '../utils/coordinate-mapping'`
- Plan 02 (useBrowserStream viewport extension) has no dependency on this plan and can execute in parallel
- All exported interfaces (ElementRect, ViewportDimensions, MappedCoordinates, ModifierKeys) available for downstream consumers

---
*Phase: 12-client-coordinate-mapping-and-click*
*Completed: 2026-01-29*
