# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Catch quality regressions before they reach users — when you modify a prompt or model, know immediately if scores dropped.
**Current focus:** Phase 5 - Run Analytics

## Current Position

Phase: 5 of 8 (Run Analytics)
Plan: 1 of 1 in current phase
Status: Phase 5 complete
Last activity: 2026-01-25 — Completed 05-01-PLAN.md (Run Analytics)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 4 min
- Total execution time: 0.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-storage-foundation | 4 | 20 min | 5 min |
| 02-execution-core | 4 | 15 min | 4 min |
| 03-agent-workflow-targets | 1 | 2 min | 2 min |
| 04-scorer-targets | 1 | 3 min | 3 min |
| 05-run-analytics | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 02-03 (5 min), 02-04 (4 min), 03-01 (2 min), 04-01 (3 min), 05-01 (4 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-25 05:45
Stopped at: Completed 05-01-PLAN.md — Run Analytics (Phase 5 complete)
Resume file: None
