# Phase 15: Input Coordination - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase ensures user input and agent browser tool calls coexist without destructive race conditions. It adds state tracking to distinguish idle, agent-active, and user-active periods, provides a visual indicator when the agent is executing a tool call, and handles user input during agent activity gracefully. This is the final phase of the v1.2 Browser Input Injection milestone.

</domain>

<decisions>
## Implementation Decisions

### Agent Busy Indicator
- All visual design decisions at Claude's discretion
- Pick whatever integrates cleanly with existing interactive mode indicator (ring-2 ring-accent1 from Phase 13)
- Whether to use overlay, badge, border change, or other approach: Claude decides
- Whether to distinguish action types (navigate vs click) or show generic busy: Claude decides
- Whether interactive mode ring changes during agent activity: Claude decides

### Input During Agent Activity
- Conflict handling approach at Claude's discretion
- Options include: allow with warning, queue until idle, or document as known limitation
- Race condition prevention level at Claude's discretion (best-effort vs strict)
- Pick the simplest approach that avoids the worst issues while keeping implementation complexity low

### State Transition Signals
- Signal mechanism at Claude's discretion (WebSocket events vs deriving from existing tool call data)
- Pick what integrates best with existing infrastructure (existing WebSocket for browser stream, existing chat/thread system)
- State persistence at Claude's discretion (ephemeral vs persisted)

### Claude's Discretion
- All three areas are fully delegated to Claude's judgment
- Agent busy indicator visual design and behavior
- Input conflict handling strategy
- State transition signal mechanism and persistence
- Ring/border behavior changes during agent activity
- Granularity of agent action feedback (generic vs action-specific)

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches. The user trusts Claude to make the right trade-offs between:
- Simplicity vs comprehensiveness in race condition prevention
- Visual feedback clarity vs implementation complexity
- Reusing existing infrastructure vs adding new signaling mechanisms

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 15-input-coordination*
*Context gathered: 2026-01-30*
