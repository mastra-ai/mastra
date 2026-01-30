---
phase: 15-input-coordination
plan: 01
subsystem: ui
tags: [react, hooks, coordination, overlay, tailwind, lucide-react]

# Dependency graph
requires:
  - phase: 10-infrastructure-foundations
    provides: BrowserToolCallsContext with pending/complete status tracking
  - phase: 12-client-coordinate-mapping
    provides: useMouseInteraction hook with enabled prop for clean listener gating
  - phase: 13-keyboard-focus
    provides: useKeyboardInteraction hook with isInteractive gating
  - phase: 14-visual-feedback
    provides: useClickRipple hook with enabled prop for suppression
provides:
  - useInputCoordination hook deriving isAgentBusy from BrowserToolCallsContext
  - AgentBusyOverlay component with Loader2 spinner and tool display name
  - BrowserViewFrame wiring that suppresses mouse/scroll during agent activity
  - Ring color coordination (green=user, amber=agent busy) in interactive mode
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived coordination state from existing context (no new infrastructure)"
    - "Input suppression via hook enabled prop toggling (listener cleanup on false)"
    - "Visual overlay with pointer-events absorption for click prevention"
    - "Ring color state encoding (green=user active, amber=agent busy)"

key-files:
  created:
    - packages/playground-ui/src/domains/agents/hooks/use-input-coordination.ts
    - packages/playground-ui/src/domains/agents/components/browser-view/agent-busy-overlay.tsx
  modified:
    - packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx

key-decisions:
  - "Agent-busy state derived from BrowserToolCallsContext (any pending tool call), no new infrastructure"
  - "Mouse clicks and scroll suppressed via enabled=false on useMouseInteraction and useClickRipple"
  - "Keyboard input continues during agent activity (safe, no destructive races)"
  - "Ring color changes from green (ring-accent1) to amber (ring-amber-400) when agent busy"
  - "TOOL_DISPLAY_NAMES map provides gerund-form labels (Navigating, Clicking, etc.)"

patterns-established:
  - "Derived coordination: read existing context, compute boolean, gate hooks -- no new state providers"
  - "Input suppression: toggle hook enabled prop rather than adding blocking layers to each handler"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 15 Plan 01: Input Coordination Summary

**useInputCoordination hook derives agent-busy state from pending tool calls, gating mouse/scroll input and showing amber ring + overlay with Loader2 spinner during agent browser tool execution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T07:01:50Z
- **Completed:** 2026-01-30T07:03:56Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- Created useInputCoordination hook that derives isAgentBusy boolean from BrowserToolCallsContext pending status with zero new infrastructure
- Created AgentBusyOverlay component with semi-transparent overlay, Loader2 spinner, and human-readable tool name display
- Wired coordination into BrowserViewFrame: mouse/scroll suppressed during agent activity, keyboard continues, ring changes green-to-amber, overlay renders conditionally

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useInputCoordination hook and AgentBusyOverlay component** - `cd63b405c9` (feat)
2. **Task 2: Wire coordination into BrowserViewFrame** - `0517476309` (feat)

## Files Created/Modified

- `packages/playground-ui/src/domains/agents/hooks/use-input-coordination.ts` - Derives isAgentBusy, activeToolName, pendingCount from BrowserToolCallsContext
- `packages/playground-ui/src/domains/agents/components/browser-view/agent-busy-overlay.tsx` - Semi-transparent overlay with Loader2 spinner and TOOL_DISPLAY_NAMES map
- `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` - Consumes useInputCoordination, gates mouse/ripple hooks, updates ring classes, renders overlay

## Decisions Made

- **Derived state, no new context provider:** isAgentBusy is a useMemo derivation from the existing BrowserToolCallsContext toolCalls array, filtering for `status === 'pending'`. No new provider, no new state management.
- **Hook enabled prop for suppression:** Rather than adding event interception or pointer-events CSS, the existing `enabled` prop on useMouseInteraction and useClickRipple cleanly removes all listeners via useEffect cleanup when set to false.
- **Keyboard continues during agent activity:** Per research recommendation, keyboard input is safe (no destructive races). useKeyboardInteraction remains gated only by isInteractive, not by isAgentBusy.
- **Gerund display names:** TOOL_DISPLAY_NAMES uses present participle form ("Navigating", "Clicking", "Reading page") for the overlay label, providing contextual feedback about what the agent is doing.
- **Overlay placement:** AgentBusyOverlay renders after ClickRippleOverlay (ripples clear via animation) and before loading/reconnecting/error overlays (those have higher priority with stronger opacity).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 15 is the final phase of v1.2 Browser Input Injection
- All v1.2 requirements delivered: INFRA (3), ROUTE (3), CLICK/SCROLL/VIS (9), KEY/FOCUS (7), VIS (2), COORD (3) = 27 total
- Known limitation: ~16ms render-cycle race window between tool dispatch and React re-render (documented, not eliminated)
- Known limitation: stuck busy overlay relies on 10s tool timeout as safety net (dismiss button deferred to future enhancement)

---
*Phase: 15-input-coordination*
*Completed: 2026-01-30*
