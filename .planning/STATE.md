# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Catch quality regressions before they reach users — when you modify a prompt or model, know immediately if scores dropped.
**Current focus:** Phase 11 - Dataset Schema Validation (IN PROGRESS)

## Current Position

Phase: 11 of 11 (Dataset Schema Validation)
Plan: 1 of 7 in phase 11
Status: In progress
Last activity: 2026-02-02 — Completed 11-01-PLAN.md

Progress: [██████████░] ~98% (43/44 plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 43
- Average duration: 4 min
- Total execution time: 2.45 hours

**By Phase:**

| Phase                        | Plans | Total  | Avg/Plan |
| ---------------------------- | ----- | ------ | -------- |
| 01-storage-foundation        | 4     | 20 min | 5 min    |
| 02-execution-core            | 4     | 15 min | 4 min    |
| 03-agent-workflow-targets    | 1     | 2 min  | 2 min    |
| 04-scorer-targets            | 1     | 3 min  | 3 min    |
| 05-run-analytics             | 1     | 4 min  | 4 min    |
| 06-playground-integration    | 12    | 48 min | 4 min    |
| 07-csv-import                | 5     | 10 min | 2 min    |
| 08-item-selection-actions    | 4     | 13 min | 3.25 min |
| 09-dataset-items-detail-view | 5     | 16 min | 3.2 min  |
| 10-dataset-layout-update     | 5     | 24 min | 4.8 min  |
| 11-dataset-schema-validation | 1     | 7 min  | 7 min    |

**Recent Trend:**

- Last 5 plans: 10-02 (9 min), 10-04 (3 min), 10-05 (5 min), 11-01 (7 min)
- Trend: Steady

_Updated after each plan completion_

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
- ReadOnlyContent/EditModeContent: Extract view modes into separate components for clarity
- Form state reset on item change via useEffect([item?.id])
- AlertDialog nested inside SideDialog uses portal to render above
- Delete confirmation state resets on item navigation
- Selection state owned by DatasetDetail parent, passes to children for synchronization
- Legacy callback props removed when functionality consolidates into child component
- SplitButton composes CombinedButtons + Popover for visual grouping
- ChevronDown icon sizing based on button size prop (sm: w-3 h-3, md/lg: w-4 h-4)
- ItemsToolbar extracted for cleaner ItemsList component
- ActionsMenu internal to ItemsToolbar (not separately exported)
- Three-dot menu for Edit/Duplicate/Delete in DatasetHeader
- Duplicate option disabled with 'Coming Soon' indicator
- Run button uses outline variant (not primary)
- ESLint disabled in lint-staged (config removed in f9764aaf1e)
- ItemDetailToolbar with SplitButton for Edit + Delete/Duplicate dropdown
- ItemDetailPanel uses SideDialog.CodeSection for JSON display consistency
- Panel structure: toolbar header + scrollable content body
- CSS Grid with conditional columns for master-detail layout (45%/55% split)
- Max-width transition: 50rem collapsed, 100rem expanded
- transitions.allSlow (300ms) for smooth layout animations
- Schema fields use JSONSchema7 | null | undefined (null = explicitly disabled)
- Validation uses existing @mastra/schema-compat jsonSchemaToZod
- Compilation caching keyed by prefix + field (e.g., 'dataset-123:input')
- Batch validation stops after maxErrors (default 10)

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 9 added: Dataset Items Detail View (EntryList, SideDialog, edit/delete flows)
- Phase 9 complete: Full click-to-view-details flow implemented
- Phase 10 added: Dataset Layout Update
- Phase 10 complete: Master-detail layout with inline item panel
- Phase 11 added: Dataset Schema Validation (input/output schema enforcement)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed 11-01-PLAN.md (Schema Validation Foundation)
Resume file: None
