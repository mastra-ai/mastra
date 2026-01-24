# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Catch quality regressions before they reach users — when you modify a prompt or model, know immediately if scores dropped.
**Current focus:** Phase 3 - Agent/Workflow Targets

## Current Position

Phase: 3 of 8 (Agent/Workflow Targets)
Plan: 1 of 1 in current phase
Status: Phase 3 complete
Last activity: 2026-01-24 — Completed 03-01-PLAN.md (Agent/Workflow Target Tests)

Progress: [████░░░░░░] 38%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 4 min
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-storage-foundation | 4 | 20 min | 5 min |
| 02-execution-core | 4 | 15 min | 4 min |
| 03-agent-workflow-targets | 1 | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 02-01 (4 min), 02-02 (2 min), 02-03 (5 min), 02-04 (4 min), 03-01 (2 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-24 23:40
Stopped at: Completed 03-01-PLAN.md — Agent/Workflow Target Tests (Phase 3 complete)
Resume file: None
