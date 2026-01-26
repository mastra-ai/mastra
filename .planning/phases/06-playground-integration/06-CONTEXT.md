# Phase 6: Playground Integration - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Full UI workflow from dataset creation through result review in playground. Includes:
- Dataset CRUD in sidebar
- Dataset detail page with items and run history
- Run triggering with target and scorer selection
- Results view with per-item outputs and scores
- Comparison view for score deltas between runs

</domain>

<decisions>
## Implementation Decisions

### Dataset Management UI
- Own top-level sidebar section under Observability
- List style like agents: name, version, created at
- Create flow: modal dialog (like "Create Agent" but no feature flag)
- Empty state: follow agents/workflows pattern

### Run Triggering Flow
- Target selection: dropdown by type (Agent/Workflow/Scorer first, then specific target)
- Scorer selection: multi-select dropdown, empty by default, labeled "Scorers (optional)"
- Progress feedback: inline progress bar on dataset detail page
- Run button location: primary action in dataset detail header

### Results Display
- Per-item results: table rows with input preview, output preview, scores, status
- Score visualization: simple numeric (no color treatment)
- Error states: red row with error message in output column
- Row expansion: click row opens side dialog (like traces/scorer results)
- Trace integration: full trace view embedded in item detail dialog

### Comparison View
- Layout: side-by-side columns (Run A left, Run B right, aligned by item)
- Run selection: checkboxes on run history list, select 2, click "Compare"
- Version mismatch warning: banner at top + per-item indicators

### Claude's Discretion
- Delta highlighting treatment (arrows, colors, etc.)
- Exact empty state illustrations/copy
- Table column widths and truncation
- Progress bar styling

</decisions>

<specifics>
## Specific Ideas

- Side dialog for item detail should match existing traces/scorer results pattern
- Create modal should match "Create Agent" modal pattern
- Sidebar placement under Observability section
- Full trace timeline embedded in item detail (not summarized)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-playground-integration*
*Context gathered: 2026-01-26*
