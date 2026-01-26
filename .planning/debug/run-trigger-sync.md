# Debug: Run Trigger Is Synchronous

## ROOT CAUSE FOUND

**Root Cause:** The server handler awaits the full `runDataset()` execution before returning the response. There is no background job queue or async dispatch - the entire dataset execution happens inline within the HTTP request/response cycle.

**Evidence:**
- `packages/server/src/server/handlers/datasets.ts` line 463: `const summary = await runDataset(mastra, {...})`
- `runDataset()` in `packages/core/src/datasets/run/index.ts` executes ALL items (via p-map) before returning
- The function loops through all items, executes targets, runs scorers, and persists results - all synchronously awaited
- Only after ALL items complete does the function return `RunSummary`

**Files Involved:**
- `/packages/server/src/server/handlers/datasets.ts` (line 463): Handler awaits full `runDataset()` completion
- `/packages/core/src/datasets/run/index.ts`: `runDataset()` is fully synchronous - processes all items before returning
- `/packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts`: Client mutation calls `triggerDatasetRun()` and awaits response
- `/packages/playground-ui/src/domains/datasets/components/run-trigger/run-trigger-dialog.tsx`: Dialog awaits `triggerRun.mutateAsync()`

**Suggested Fix Direction:**
1. **Option A (Quick):** Server handler should spawn `runDataset()` without awaiting, create run record first with `pending` status, return runId immediately
2. **Option B (Better):** Introduce a job queue (in-memory or persistent) that handles dataset runs asynchronously
3. The UI already has polling via `useDatasetRun` hook (polls every 2s while `status === 'running' || status === 'pending'`) - it just never sees `pending` state because server waits for completion

**Code Flow:**
```
UI: triggerRun.mutateAsync() -----> awaits response
                                        |
Server: TRIGGER_RUN_ROUTE -----> await runDataset() <-- BLOCKS HERE
                                        |
Core: runDataset() -----> executes ALL items
                    -----> runs ALL scorers
                    -----> persists ALL results
                    -----> returns RunSummary
                                        |
Server: returns summary <-------------- ONLY NOW
                                        |
UI: receives response <---------------- ONLY NOW (too late for polling)
```

**Expected Flow:**
```
UI: triggerRun.mutateAsync() -----> awaits response
                                        |
Server: TRIGGER_RUN_ROUTE -----> create run with status='pending'
                          -----> spawn runDataset() (no await)
                          -----> return { runId } immediately
                                        |
UI: receives runId <------------------- IMMEDIATE
    |
    |---> starts polling useDatasetRun()
    |
Background: runDataset() executes items, updates status='running', then 'completed'
    |
UI: polling sees status transitions
```
