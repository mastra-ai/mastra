# Phase 7: V2 Model + TripWire Support - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Agent steps support V2 models (using .stream() instead of .streamLegacy()) and propagate TripWire errors from output processors to workflow results. This is runtime parity work — behavior is defined by the default runtime implementation.

</domain>

<decisions>
## Implementation Decisions

### Approach
- Match default runtime behavior exactly — no design decisions needed
- Researcher should study default runtime implementation to understand patterns
- Planner should derive tasks from default runtime code paths

### Claude's Discretion
- V2 detection strategy (derive from default runtime)
- TripWire serialization format (match default runtime)
- Status mapping logic (match default runtime)
- Error boundary placement (match default runtime)

</decisions>

<specifics>
## Specific Ideas

"I think you should be able to figure out how each of these should work judging by the other runtimes"

This is parity work — the default runtime is the specification.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-v2-tripwire*
*Context gathered: 2026-01-27*
