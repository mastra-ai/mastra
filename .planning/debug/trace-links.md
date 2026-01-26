# Debug: Trace Links Missing in Dataset Item Results

## ROOT CAUSE FOUND

**Root Cause:** traceId is available from agent/workflow execution but never captured or stored in dataset run results

**Evidence:**
- Agent `generate()` returns `FullOutput` with `traceId` field (packages/core/src/stream/base/output.ts:122)
- Workflow `run.start()` returns result with `traceId` field (packages/core/src/workflows/workflow.ts:2691)
- `ExecutionResult` interface in executor.ts only captures `output` and `error` - no traceId (packages/core/src/datasets/run/executor.ts:16-21)
- `DATASET_RUN_RESULTS_SCHEMA` has no `traceId` column (packages/core/src/storage/constants.ts:169-183)
- `RunResultData` UI interface has no `traceId` field (packages/playground-ui/src/domains/datasets/components/results/results-table.tsx:19-33)
- `ResultDetailDialog` displays metadata but has no trace link (packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx)

**Files Involved:**
- `packages/core/src/datasets/run/executor.ts:16-21`: `ExecutionResult` interface missing traceId
- `packages/core/src/datasets/run/index.ts:122-146`: executeTarget result not capturing traceId
- `packages/core/src/storage/constants.ts:169-183`: Schema missing traceId column
- `packages/playground-ui/src/domains/datasets/components/results/results-table.tsx:19-33`: UI type missing traceId
- `packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx`: Dialog not displaying trace link

**Suggested Fix Direction:**
1. Add `traceId` to `ExecutionResult` interface in executor.ts
2. Capture traceId from agent/workflow results in executeAgent/executeWorkflow functions
3. Add `traceId` column to `DATASET_RUN_RESULTS_SCHEMA`
4. Update `addResult` call in runDataset to include traceId
5. Add traceId to `RunResultData` UI type
6. Add trace link to `ResultDetailDialog` KeyValueList (pattern exists in trace-dialog.tsx)

---

## Data Flow Analysis

```
agent.generate() / workflow.run.start()
        |
        v (traceId available here)
executeTarget() in executor.ts
        |
        v (traceId LOST - ExecutionResult only has output/error)
runDataset() in index.ts
        |
        v (no traceId to store)
runsStore.addResult()
        |
        v (schema has no traceId)
DATASET_RUN_RESULTS table
        |
        v (no traceId in data)
playground-ui ResultDetailDialog
        |
        v (cannot display what doesn't exist)
```

## Comparison: How Traces Work Elsewhere

In `packages/playground-ui/src/domains/observability/components/trace-dialog.tsx`:
- Receives `traceId` prop directly
- Uses `computeTraceLink(traceId)` to generate navigation link
- Pattern: KeyValueList with link to `/traces/{traceId}`

The dataset results view needs the same pattern but the data layer doesn't support it yet.
