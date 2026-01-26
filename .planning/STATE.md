# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Catch quality regressions before they reach users — when you modify a prompt or model, know immediately if scores dropped.
**Current focus:** Phase 6 - Playground Integration

## Current Position

Phase: 6 of 8 (Playground Integration)
Plan: 1 of 6 in current phase
Status: In progress
Last activity: 2026-01-26 — Completed 06-01-PLAN.md (Datasets REST API)

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 4 min
- Total execution time: 0.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-storage-foundation | 4 | 20 min | 5 min |
| 02-execution-core | 4 | 15 min | 4 min |
| 03-agent-workflow-targets | 1 | 2 min | 2 min |
| 04-scorer-targets | 1 | 3 min | 3 min |
| 05-run-analytics | 1 | 4 min | 4 min |
| 06-playground-integration | 1 | 6 min | 6 min |

**Recent Trend:**
- Last 5 plans: 02-04 (4 min), 03-01 (2 min), 04-01 (3 min), 05-01 (4 min), 06-01 (6 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-26 06:06
Stopped at: Completed 06-01-PLAN.md — Datasets REST API
Resume file: None
