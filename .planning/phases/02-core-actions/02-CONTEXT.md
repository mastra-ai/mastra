# Phase 2: Core Actions - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents can perceive page structure via accessibility snapshots and interact with elements using refs. Tools: snapshot, click, type, scroll. Screenshot is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Snapshot format
- Formatted tree (indented hierarchy showing structure)
- Elements show: role + name + ref (e.g., `button "Submit" @e5`)
- Default to viewport-only (viewportOnly: true by default)
- Include summary line at top with counts ("Page has 23 interactive elements, showing 15 in viewport")
- Include page context: URL and title
- Show current form field values inline
- Mark currently focused element with [focused]
- Show checkbox/radio checked state inline [checked]
- Include disabled elements with [disabled] marker
- Show current selected option for dropdowns
- Links show href domain only (→ example.com)
- Use aria-label for image buttons
- Table cells include row/column context
- maxElements parameter with sensible default (50) to cap output size
- Interactive elements only by default

### Ref persistence
- Fresh refs on every new snapshot (no persistence between snapshots)
- Format: @e1, @e2, @e3... (sequential numbering)
- Toolset stores ref-to-element mapping internally
- If agent uses ref without snapshot: auto-snapshot then act
- No explicit ref verification tool — just try action, get error if stale

### Interaction feedback
- Token-efficient responses are priority
- type tool returns: { success: true, value: 'current field value' }
- scroll tool returns: { success: true, position: { x, y } }
- click/type: Claude decides minimal useful info that helps agent's next decision

### Error recovery
- Claude designs error structure for LLM comprehension
- Include recovery hints only when agent can actually do something about it
- When element covered/not clickable: error with explanation (no auto-retry)
- Debug mode adds technical details; normal mode is LLM-friendly only

### Claude's Discretion
- Auto-snapshot in click/type: whether to return minimal summary or nothing
- Ref numbering: 1-indexed or 0-indexed
- Exact response structure balancing token efficiency with usefulness
- Error structure design

</decisions>

<specifics>
## Specific Ideas

- Token efficiency is a priority throughout — avoid verbose responses
- Snapshot should help agent understand page without overwhelming context
- Table row/column context matters — agent needs to know which row it's acting on
- Focus state tracking helps with keyboard-based interactions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-core-actions*
*Context gathered: 2026-01-26*
