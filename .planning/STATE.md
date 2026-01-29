# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Catch quality regressions before they reach users — when you modify a prompt or model, know immediately if scores dropped.
**Current focus:** Phase 9 - Dataset Items Detail View

## Current Position

Phase: 9 of 9 (Dataset Items Detail View) — In progress
Plan: 2 of 5 in phase 9
Status: Executing phase 9
Last activity: 2026-01-29 — Completed 09-02-PLAN.md (Item Detail Dialog)

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**
- Total plans completed: 34
- Average duration: 4 min
- Total execution time: 1.92 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-storage-foundation | 4 | 20 min | 5 min |
| 02-execution-core | 4 | 15 min | 4 min |
| 03-agent-workflow-targets | 1 | 2 min | 2 min |
| 04-scorer-targets | 1 | 3 min | 3 min |
| 05-run-analytics | 1 | 4 min | 4 min |
| 06-playground-integration | 12 | 48 min | 4 min |
| 07-csv-import | 5 | 10 min | 2 min |
| 08-item-selection-actions | 4 | 13 min | 3.25 min |
| 09-dataset-items-detail-view | 2 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 08-03 (3 min), 08-04 (4 min), 09-01 (3 min), 09-02 (3 min)
- Trend: Steady

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Storage domain: New DatasetsStorage follows existing pattern (workflows, memory, scores)
- Auto-versioning: Items changes increment version automatically (simpler UX than explicit)
- Scorers passed to run: Separates concerns, allows different scoring per experiment
- Input stored as unknown: Target adapter normalizes at execution time
- Defer virtual folders: Organizational polish, not core workflow (v1.1)
- Timestamp-based versioning: dataset.version and item.version are Date objects
- Snapshot semantics: version queries filter items by item.version <= requested version
- 0-indexed pagination: Matches existing storage adapter patterns
- Inline scoring: scorers run immediately after each item execution (not batched)
- Error isolation: failing scorer doesn't affect other scorers or item results
- v1 context limitation: Request context not passed to agent (documented in tests per CONTEXT.md deferral)
- Direct passthrough: item.input contains exactly what scorer expects (no field mapping)
- User structures item.input for scorer calibration: { input, output, groundTruth }
- Nested-by-scorer: Comparison result uses { scorers: { accuracy: {...} } } structure
- Default threshold: 0 with higher-is-better direction for regression detection
- Nested routes: runs under /datasets/:datasetId/runs for clear resource hierarchy
- successResponseSchema for delete operations (matches existing pattern)
- encodeURIComponent on all path params for safety (client SDK)
- Pagination via URLSearchParams pattern (client SDK)
- useDatasetRun polls every 2s while status is running/pending
- Mutations invalidate relevant query caches on success
- Datasets placed in Observability sidebar section (isOnMastraPlatform: true)
- DatasetsTable follows agent-table pattern with columns.tsx separation
- ScoreDelta uses unicode arrows for direction indicators
- AlertDescription requires explicit 'as' prop for semantic HTML
- Routes use lazy loading pattern for code splitting
- Two-step target selection: type first (agent/workflow/scorer), then specific target
- Scorer selection optional, only for agent/workflow targets
- Scores embedded in RunResult (not separate query) for simpler data model
- Trace link uses /observability?traceId=xxx pattern for pre-selected trace
- traceId captured from agent/workflow result and stored with run results
- Item delete uses inline AlertDialog in ItemsList (matches chat-threads pattern)
- Edit dialogs use useEffect to sync form state when props change
- JSON auto-parse: CSV cells starting with { or [ attempt JSON.parse
- Empty CSV cells become null (not empty string)
- Web worker threshold: 1MB file size for CSV parsing
- Row numbers 1-indexed + 1 for header (first data row is 2)
- Multi-column mapping: combine into object with column names as keys
- Sequential CSV import with progress tracking (not batched)
- Import CSV button uses outline variant to distinguish from Add Item primary action
- Optional action props pattern: only render UI when callback provided
- useEffect rebuilds entire mapping on headers change (not incremental merge)
- Sequential item copying with progress - simpler than batch, shows user feedback
- Disable dialog close during creation - prevents partial state
- Export action clears selection immediately (no dialog needed)
- Create Dataset and Delete defer clearing to parent via clearSelectionTrigger
- Match traces-list pattern for UI consistency (EntryList in datasets domain)
- Checkbox column dynamically added when selection mode active
- Entry click behavior changes based on selection mode
- Navigation returns undefined to disable buttons at list boundaries (SideDialogNav pattern)
- Placeholder div for Edit/Delete buttons ready for subsequent plans

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 9 added: Dataset Items Detail View (EntryList, SideDialog, edit/delete flows)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-29
Stopped at: Completed 09-02-PLAN.md (Item Detail Dialog)
Resume file: None
