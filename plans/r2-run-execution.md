# R2: Run Execution Implementation

Core evaluation feature - run an agent against a dataset.

---

## Status: Complete

**Target:** Execute agent against dataset items and store results

---

## Pre-requisites (Already Exist)

| Layer   | Method                    | Status |
| ------- | ------------------------- | ------ |
| Storage | `createDatasetRun`        | Done   |
| Storage | `updateDatasetRun`        | Done   |
| Storage | `createDatasetRunResult`  | Done   |
| Storage | `createDatasetRunResults` | Done   |
| Core    | `runDataset()` function   | Done   |
| Mastra  | `mastra.runDataset()`     | Done   |

**Core run.ts already implements:**

- Concurrency control (sequential or pooled)
- Progress callbacks (`onProgress`)
- Per-item result storage
- Error handling
- Agent and workflow targets

---

## Key Decisions

| Question               | Decision                                      |
| ---------------------- | --------------------------------------------- |
| Run execution location | Server-side (via API route)                   |
| Progress tracking      | Polling (simple, works everywhere)            |
| Agent selection        | All registered agents from mastra.getAgents() |

---

## Tasks

### Batch 1: Server Routes

| ID  | Task                                     | Status |
| --- | ---------------------------------------- | ------ |
| 1a  | Add `createDatasetRunBodySchema`         | done   |
| 1b  | Add `datasetRunIdPathParams` schema      | done   |
| 1c  | Add `CREATE_DATASET_RUN_ROUTE` (POST)    | done   |
| 1d  | Add `GET_DATASET_RUN_ROUTE` (single run) | done   |
| 1e  | Register routes                          | done   |

**Files:**

- `packages/server/src/server/schemas/datasets.ts`
- `packages/server/src/server/handlers/datasets.ts`
- `packages/server/src/server/server-adapter/routes/datasets.ts`

---

### Batch 2: Client SDK

| ID  | Task                                     | Status |
| --- | ---------------------------------------- | ------ |
| 2a  | Add `createDatasetRun` method            | done   |
| 2b  | Add `getDatasetRun` method               | done   |
| 2c  | Add `CreateDatasetRunParams` type export | done   |

**Files:**

- `client-sdks/client-js/src/client.ts`
- `client-sdks/client-js/src/types.ts`

---

### Batch 3: UI Hooks

| ID  | Task                                   | Status |
| --- | -------------------------------------- | ------ |
| 3a  | Add `useCreateDatasetRun` mutation     | done   |
| 3b  | Add `useDatasetRun` query (single run) | done   |

**Files:**

- `packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts`

---

### Batch 4: UI Components

| ID  | Task                                         | Status |
| --- | -------------------------------------------- | ------ |
| 4a  | Add `useAgents` hook check (already exists?) | done   |
| 4b  | Create `RunDatasetDialog` (agent selector)   | done   |
| 4c  | Add "Run" button to dataset header           | done   |

**Files:**

- `packages/playground-ui/src/domains/datasets/components/run-dataset-dialog.tsx`
- `packages/playground-ui/src/domains/datasets/components/dataset-information/dataset-information.tsx`

---

## Progress

- [x] Batch 1: Server routes (5/5)
- [x] Batch 2: Client SDK (3/3)
- [x] Batch 3: UI Hooks (2/2)
- [x] Batch 4: UI Components (3/3)

**Total: 13/13 tasks**

---

## Architecture

### Run Flow

```
1. User clicks "Run" → Opens RunDatasetDialog
2. User selects agent → Clicks "Start Run"
3. Client calls POST /api/datasets/:id/runs { agentId }
4. Server:
   a. Creates run record (status: running)
   b. Calls mastra.runDataset() synchronously
   c. Returns completed run
5. Client receives result, refetches runs list
```

### API Design

```
POST /api/datasets/:datasetId/runs
Body: { agentId: string, name?: string }
Response: { run: DatasetRun }

GET /api/datasets/:datasetId/runs/:runId
Response: { run: DatasetRun }
```

---

## Notes

- Run execution is synchronous (blocks until complete)
- For large datasets, may need async execution + polling later
- Agent selection uses mastra.getAgents() to list available agents
