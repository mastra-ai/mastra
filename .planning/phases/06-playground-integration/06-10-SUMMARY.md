---
phase: '06'
plan: '10'
subsystem: datasets
tags: [traceId, observability, UI, debugging]
depends_on:
  requires: [06-01, 06-02, 06-03, 06-04, 06-05, 06-06]
  provides: [trace-links-in-results]
  affects: []
tech-stack:
  added: []
  patterns: [trace-id-capture, framework-link-component]
key-files:
  created: []
  modified:
    - packages/core/src/datasets/run/executor.ts
    - packages/core/src/storage/constants.ts
    - packages/core/src/storage/types.ts
    - packages/core/src/datasets/run/index.ts
    - packages/playground-ui/src/domains/datasets/components/results/results-table.tsx
    - packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx
decisions: []
metrics:
  duration: 4 min
  completed: 2026-01-26
---

# Phase 6 Plan 10: Trace Link Support Summary

**One-liner:** traceId captured from agent/workflow execution, persisted, and displayed as clickable link in result detail dialog

## What Was Built

1. **ExecutionResult traceId capture** - Added traceId field to ExecutionResult interface, captured from agent.generate() and workflow run.start() results
2. **Storage schema update** - Added traceId column to DATASET_RUN_RESULTS_SCHEMA and types
3. **UI trace link** - Added "View Trace" link in result detail dialog that navigates to /traces/:traceId

## Implementation Details

### executor.ts Changes

- ExecutionResult interface extended with `traceId: string | null`
- executeAgent captures traceId from result object
- executeWorkflow captures traceId from result object (all status branches)
- executeScorer returns traceId: null (scorers don't produce traces)
- Error cases return traceId: null

### Storage Changes

- DATASET_RUN_RESULTS_SCHEMA: added `traceId: { type: 'text', nullable: true }`
- RunResult interface: added `traceId?: string | null`
- AddRunResultInput interface: added `traceId?: string | null`
- runDataset: passes execResult.traceId to addResult

### UI Changes

- RunResultData interface: added `traceId?: string | null`
- ResultDetailDialog: displays trace link in KeyValueList when traceId exists
- Uses framework Link component with `href` prop (not `to`)

## Commits

| Task | Commit     | Description                                             |
| ---- | ---------- | ------------------------------------------------------- |
| 1    | 85fab311af | Add traceId to ExecutionResult and capture from targets |
| 2    | b914ef7a95 | Add traceId to storage schema and persist               |
| 3    | 982f25896c | Display traceId in result detail dialog with link       |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] packages/core builds successfully
- [x] packages/playground-ui builds successfully
- [x] packages/playground builds successfully
- [x] All must_haves satisfied:
  - traceId captured from agent/workflow execution
  - traceId stored in run results
  - traceId displayed in result detail dialog
  - Trace link navigates to /traces/:traceId
