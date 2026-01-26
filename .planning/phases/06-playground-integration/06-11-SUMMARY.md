---
phase: 06-playground-integration
plan: 11
status: complete
started: 2026-01-26T23:00:00Z
completed: 2026-01-26T23:15:00Z
commits:
  - 02bb70d653 - fix(06-11): make traceId required in RunResult type
  - ee134de661 - fix(06-11): add traceId to API and auto-refresh results
---

## Summary

Fixed two UAT gaps from retest: traceId missing from API response schema and results not auto-refreshing when run completes.

## Tasks Completed

### Task 1: Add traceId to server response schema

Added `traceId: z.string().nullable()` to `runResultResponseSchema` in `packages/server/src/server/schemas/datasets.ts`.

Also required type alignment:
- Made `RunResult.traceId` required (not optional) in core types
- Updated inmemory storage to include traceId with null default
- Updated libsql storage to read and write traceId

### Task 2: Refactor useDatasetRunResults to object params and add polling

Refactored `useDatasetRunResults` hook to:
- Use object params `{ datasetId, runId, pagination?, runStatus? }` instead of positional args
- Poll every 2 seconds when `runStatus` is `'pending'` or `'running'`

Updated consumer in `packages/playground/src/pages/datasets/dataset/run/index.tsx` to pass `runStatus: run?.status`.

## Verification

- `pnpm build` passes for @mastra/core, @mastra/libsql, @mastra/server, @mastra/playground-ui, @internal/playground
- traceId field present in runResultResponseSchema
- useDatasetRunResults has refetchInterval logic
- Consumer passes run.status to useDatasetRunResults

## Artifacts

| File | Change |
|------|--------|
| packages/server/src/server/schemas/datasets.ts | traceId: z.string().nullable() in schema |
| packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts | Object params + refetchInterval |
| packages/playground/src/pages/datasets/dataset/run/index.tsx | Pass runStatus to hook |
| packages/core/src/storage/types.ts | RunResult.traceId required |
| packages/core/src/storage/domains/runs/inmemory.ts | Include traceId in addResult |
| stores/libsql/src/storage/domains/runs/index.ts | Include traceId in transform and addResult |

## Deviations

Core type changes were required to align `RunResult.traceId` with the schema. The type was optional (`traceId?: string | null`) but needed to be required (`traceId: string | null`) since the database column always has a value (either a string or null).
