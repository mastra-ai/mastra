# Phase 9: Studio UI - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

BrowserViewPanel component renders live screencast frames inline with agent chat in Mastra Studio. View-only for v1 — user interaction with the browser view belongs in a future phase.

</domain>

<decisions>
## Implementation Decisions

### Panel Layout
- Right panel layout — browser view as right sidebar, chat on left
- Resizable with drag handle — user can adjust panel width
- Auto-hide when no browser — panel only appears when browser is active for the agent
- Default width ~500px (balanced) — good visibility without overwhelming chat

### Frame Rendering
- Fit to panel width — scale frame to fill panel width, maintain aspect ratio
- URL bar header — show current URL in minimal header above the frame
- View only — clicking on browser frame does nothing in v1

### Connection States
- Small status dot indicator — colored dot in corner of panel or header
- Standard traffic light colors — green (connected), yellow (connecting), red (disconnected)
- Overlay on last frame when disconnected — show 'Disconnected' overlay on captured frame
- Auto-reconnect with indicator — automatically retry, show 'Reconnecting...' state

### Empty & Loading States
- Skeleton placeholder on loading — gray placeholder matching viewport shape with subtle animation
- Panel auto-hides when empty — since auto-hide chosen, no browser = no panel visible
- Error overlay with retry — error message on panel with 'Retry' button
- Fade out and auto-hide on browser close — panel fades away after browser stops

### Claude's Discretion
- Frame update transitions (smooth direct vs fade)
- Exact skeleton animation style
- Reconnection retry timing and backoff
- Drag handle visual styling

</decisions>

<specifics>
## Specific Ideas

- Auto-hide behavior creates clean UX — browser panel appears only when relevant
- URL bar header provides context without full browser chrome
- Fade out on close gives smooth transition rather than jarring disappear

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-studio-ui*
*Context gathered: 2026-01-27*
