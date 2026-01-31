---
phase: 06-playground-integration
plan: 12
subsystem: datasets
tags: [scores, trace-link, storage, api, ui]
completed: 2026-01-26

dependency_graph:
  requires: [06-10, 06-11]
  provides: [scores-in-results, working-trace-link]
  affects: [uat-verification]

tech_stack:
  added: []
  patterns: [embedded-scores, query-param-navigation]

key_files:
  created: []
  modified:
    - packages/core/src/storage/types.ts
    - packages/core/src/storage/constants.ts
    - packages/core/src/storage/domains/runs/inmemory.ts
    - packages/core/src/datasets/run/index.ts
    - stores/libsql/src/storage/domains/runs/index.ts
    - packages/server/src/server/schemas/datasets.ts
    - packages/playground-ui/src/domains/datasets/components/results/results-table.tsx
    - packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx
    - packages/playground/src/pages/datasets/dataset/run/index.tsx

decisions:
  - id: embedded-scores
    decision: Scores stored as part of RunResult, not separately
    rationale: Simpler data model, single query for results with scores
  - id: trace-query-param
    decision: Trace link uses /observability?traceId=xxx pattern
    rationale: Opens observability page with trace pre-selected in dialog

metrics:
  duration: 8 min
---

# Phase 06 Plan 12: Gap Closure - Scores and Trace Link Summary

Scores embedded in results and trace link navigates to observability page.

## Tasks Completed

| Task | Name                           | Commit  | Key Changes                          |
| ---- | ------------------------------ | ------- | ------------------------------------ |
| 1    | Add scores to RunResult type   | 329544e | ScorerResult interface, scores field |
| 2    | Store scores with result       | 9a7605f | Include scores in addResult call     |
| 3    | Update storage implementations | d6a0eb5 | Schema column, JSON serialization    |
| 4    | Server response schema         | 6870646 | scorerResultSchema, scores array     |
| 5    | UI uses result.scores          | 79dae4a | Remove separate scores query         |
| 6    | Fix trace link                 | 54f6324 | /observability?traceId=xxx           |

## Changes Made

### Type System

- Added `ScorerResult` interface to storage types
- Added `scores: ScorerResult[]` to `RunResult`
- Added optional `scores` to `AddRunResultInput`

### Storage Layer

- Added `scores` column to DATASET_RUN_RESULTS_SCHEMA (jsonb)
- InMemory: includes scores in result object
- LibSQL: JSON serializes/deserializes scores

### Run Orchestration

- `runDataset` now passes `itemScores` to `addResult`
- Scores persisted with result in single operation

### API Layer

- Added `scorerResultSchema` to server schemas
- Added `scores` array to `runResultResponseSchema`

### UI Layer

- Updated `RunResultData` to include `scores` field
- Removed `scores` prop from `ResultsTableProps`
- ResultsTable reads from `result.scores` directly
- Removed `useScoresByRunId` usage from run page
- Trace link: `/traces/xxx` -> `/observability?traceId=xxx`

## Verification

- All packages build successfully
- RunResult type includes scores field
- Storage backends handle scores serialization
- Server schema includes scores in response
- UI displays scores from result.scores
- Trace link navigates to observability page

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

UAT re-verification with all gaps closed.
