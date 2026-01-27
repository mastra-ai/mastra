# R5: Trace Linking for Dataset Run Results

## Problem

Dataset run results have `traceId` and `spanId` fields but they're never populated. Users can't navigate from a result to view the execution trace.

## Current State

- `DatasetRunResult` schema has optional `traceId` and `spanId` fields
- `agent.generate()` returns `FullOutput` which includes `traceId`
- `processItem()` in `run.ts` doesn't extract or store trace info

---

## Tasks

### R5.1: Capture traceId in processItem

**File:** `packages/core/src/datasets/run.ts`

Extract `traceId` from agent/workflow result and include in result:

```typescript
// Agent execution
const result = await agent.generate(JSON.stringify(item.input));
actualOutput = result;
traceId = result.traceId;  // Extract from FullOutput

// Return with traceId
return {
  id: randomUUID(),
  runId,
  itemId: item.id,
  actualOutput,
  traceId,  // Add this
  status: 'success',
  ...
};
```

### R5.2: Update storage calls to include traceId

**File:** `packages/core/src/datasets/run.ts`

Pass `traceId` when calling `storage.createDatasetRunResult()`:

```typescript
await storage.createDatasetRunResult({
  runId: run.id,
  itemId: item.id,
  actualOutput: result.actualOutput,
  traceId: result.traceId,  // Add this
  status: result.status,
  ...
});
```

### R5.3: Add trace link to UI results table

**File:** `packages/playground-ui/src/domains/datasets/components/run-results-table/columns.tsx`

Add a "Trace" column with link if `traceId` exists:

```tsx
{
  header: 'Trace',
  cell: ({ row }) => {
    const result = row.original;
    if (!result.traceId) return <Cell>—</Cell>;
    return (
      <Cell>
        <Link to={`/observability?traceId=${result.traceId}`}>
          View
        </Link>
      </Cell>
    );
  },
}
```

---

## Files to Modify

1. `packages/core/src/datasets/run.ts` - capture traceId in processItem
2. `packages/playground-ui/src/domains/datasets/components/run-results-table/columns.tsx` - add trace column

---

## Notes

- `spanId` is not currently exposed in `FullOutput`, only `traceId`
- `traceId` is sufficient for linking to traces (spans are children of the trace)
- Workflow execution may need similar handling (check `workflowRun.start()` return value)

---

## Verification

1. Run a dataset against an agent
2. View run results
3. Verify traceId appears in results
4. Click trace link and verify it navigates to observability page with correct trace
