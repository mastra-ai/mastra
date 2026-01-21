# Datasets Feature Implementation Plan

## Overview

Add a Datasets feature to Mastra for storing collections of input/output examples, capturing production traces as dataset items, and running evaluations against datasets.

**Key Features:**

- Timestamp-based versioning (industry standard: Langfuse, LangSmith, Braintrust)
- Trace-to-dataset capture from production
- Dataset run orchestration with scoring
- Pluggable storage (in-memory, LibSQL, PostgreSQL later)

---

## Data Model

```typescript
interface Dataset {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface DatasetItem {
  id: string;
  datasetId: string;
  input: unknown;
  expectedOutput?: unknown;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string; // If captured from trace
  sourceSpanId?: string;
  archivedAt?: Date; // Soft delete for versioning
  createdAt: Date;
  updatedAt: Date;
}

interface DatasetRun {
  id: string;
  datasetId: string;
  name?: string;
  targetType: 'AGENT' | 'WORKFLOW' | 'CUSTOM';
  targetId?: string;
  scorerIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  itemCount: number;
  completedCount: number;
  createdAt: Date;
  completedAt?: Date;
}

interface DatasetRunResult {
  id: string;
  runId: string;
  itemId: string;
  actualOutput: unknown;
  traceId?: string;
  spanId?: string;
  status: 'success' | 'error';
  error?: string;
  createdAt: Date;
}
```

---

## Parallelizable Task Breakdown

### Dependency Graph

```
A (types)
├─► B (constants)
├─► C (base class) ─────► F (inmemory impl) ──► J (mock.ts)
│                  └────► G (libsql impl) ───► K (libsql store)
├─► D (inmemory-db) ────► F (inmemory impl)
├─► E (trace-capture) ──► T1 (trace-capture tests)
└─► H (run.ts)

C, F, G ─► I (StorageDomains type)
C ───────► L (domains/index.ts)
I, J, K, L ─► M (mastra integration)
E, H ──────► N (datasets/index.ts)

Tests:
F ─────────► T2 (inmemory tests)
H ─────────► T3 (run.ts tests)
K ─────────► T4 (libsql integration tests)
M ─────────► T5 (mastra integration tests)

Future:
C ─────────► P1 (pg impl) ──► P2 (pg store) ──► P3 (pg tests)
```

---

## Wave 1: Foundation

**Parallelism:** 1 task (blocking)

| Task  | File                                  | Description                                                                                                                 |
| ----- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **A** | `packages/core/src/datasets/types.ts` | Create Zod schemas and TypeScript types for Dataset, DatasetItem, DatasetRun, DatasetRunResult, and all list/response types |

**Blocked by:** Nothing
**Blocks:** All other tasks

---

## Wave 2: Core Infrastructure

**Parallelism:** 4 tasks in parallel

| Task  | File                                                 | Description                                                                                                          | Depends On |
| ----- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| **B** | `packages/core/src/storage/constants.ts`             | Add `TABLE_DATASETS`, `TABLE_DATASET_ITEMS`, `TABLE_DATASET_RUNS`, `TABLE_DATASET_RUN_RESULTS` constants and schemas | A          |
| **C** | `packages/core/src/storage/domains/datasets/base.ts` | Create abstract `DatasetsStorage` class with all CRUD method signatures                                              | A          |
| **D** | `packages/core/src/storage/domains/inmemory-db.ts`   | Add `datasets`, `datasetItems`, `datasetRuns`, `datasetRunResults` Maps                                              | A          |
| **E** | `packages/core/src/datasets/trace-capture.ts`        | Create `captureSpanToDataset`, `captureTraceToDataset`, `captureTracesToDataset` functions                           | A          |

---

## Wave 3: Implementations

**Parallelism:** 4 tasks in parallel

| Task   | File                                                         | Description                                                                                                  | Depends On |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------- |
| **F**  | `packages/core/src/storage/domains/datasets/inmemory.ts`     | Implement `DatasetsInMemory` class with all CRUD operations, versioning support (`asOf` queries), pagination | C, D       |
| **G**  | `stores/libsql/src/storage/domains/datasets/index.ts`        | Implement `DatasetsLibSQL` class with SQL queries, indexes, migrations                                       | C          |
| **H**  | `packages/core/src/datasets/run.ts`                          | Create `runDataset` orchestration function                                                                   | A          |
| **T1** | `packages/core/src/datasets/__tests__/trace-capture.test.ts` | Unit tests for trace-capture functions                                                                       | E          |

---

## Wave 4: Domain Registration

**Parallelism:** 6 tasks in parallel

| Task   | File                                                                    | Description                                                                | Depends On |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| **I**  | `packages/core/src/storage/base.ts`                                     | Add `datasets?: DatasetsStorage` to `StorageDomains` type, update `init()` | C          |
| **J**  | `packages/core/src/storage/mock.ts`                                     | Instantiate `DatasetsInMemory` in `InMemoryStore.stores`                   | F          |
| **K**  | `stores/libsql/src/storage/index.ts`                                    | Instantiate `DatasetsLibSQL` in `LibSQLStore.stores`                       | G          |
| **L**  | `packages/core/src/storage/domains/datasets/index.ts`                   | Create index file exporting `base.ts` and `inmemory.ts`                    | C, F       |
| **T2** | `packages/core/src/storage/domains/datasets/__tests__/inmemory.test.ts` | Unit tests for inmemory implementation (CRUD, versioning, pagination)      | F          |
| **T3** | `packages/core/src/datasets/__tests__/run.test.ts`                      | Unit tests for runDataset orchestration                                    | H          |

---

## Wave 5: Integration

**Parallelism:** 3 tasks in parallel

| Task   | File                                                                 | Description                                                                                           | Depends On |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| **M**  | `packages/core/src/mastra/index.ts`                                  | Add `captureSpanToDataset()`, `captureTraceToDataset()`, `runDataset()`, `getDatasetsStore()` methods | I, J, K, L |
| **N**  | `packages/core/src/datasets/index.ts`                                | Create package index exporting types, trace-capture, and run                                          | E, H       |
| **T4** | `stores/libsql/src/storage/domains/datasets/__tests__/index.test.ts` | LibSQL integration tests                                                                              | K          |

---

## Wave 6: Domain Exports & Final Tests

**Parallelism:** 2 tasks in parallel

| Task   | File                                                  | Description                                  | Depends On |
| ------ | ----------------------------------------------------- | -------------------------------------------- | ---------- |
| **O**  | `packages/core/src/storage/domains/index.ts`          | Add `export * from './datasets'`             | L          |
| **T5** | `packages/core/src/mastra/__tests__/datasets.test.ts` | Integration tests for Mastra dataset methods | M          |

---

## Future: PostgreSQL Support

**Priority:** Lower — implement after inmemory + libsql are stable

| Task   | File                                                             | Description                                                        | Depends On |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| **P1** | `stores/pg/src/storage/domains/datasets/index.ts`                | Implement `DatasetsPG` class with SQL queries, indexes, migrations | C          |
| **P2** | `stores/pg/src/storage/index.ts`                                 | Instantiate `DatasetsPG` in `PostgresStore.stores`                 | P1         |
| **P3** | `stores/pg/src/storage/domains/datasets/__tests__/index.test.ts` | PostgreSQL integration tests (requires Docker)                     | P2         |

---

## Summary Table

| Wave   | Tasks              | Parallel?  | Complexity | Estimated LOC                 |
| ------ | ------------------ | ---------- | ---------- | ----------------------------- |
| 1      | A                  | No         | Medium     | ~200                          |
| 2      | B, C, D, E         | Yes (4)    | Medium     | ~50, ~80, ~20, ~100           |
| 3      | F, G, H, T1        | Yes (4)    | High       | ~250, ~300, ~150, ~80         |
| 4      | I, J, K, L, T2, T3 | Yes (6)    | Medium     | ~20, ~10, ~10, ~5, ~150, ~100 |
| 5      | M, N, T4           | Yes (3)    | Medium     | ~80, ~10, ~150                |
| 6      | O, T5              | Yes (2)    | Medium     | ~2, ~150                      |
| Future | P1, P2, P3         | Sequential | Medium     | ~300, ~10, ~150               |

**Total: 20 tasks (6 waves) + 3 future tasks, ~1,900 LOC + ~460 LOC (pg)**

---

## File Summary

### New Files (8)

| File                                                     | Task |
| -------------------------------------------------------- | ---- |
| `packages/core/src/datasets/types.ts`                    | A    |
| `packages/core/src/datasets/trace-capture.ts`            | E    |
| `packages/core/src/datasets/run.ts`                      | H    |
| `packages/core/src/datasets/index.ts`                    | N    |
| `packages/core/src/storage/domains/datasets/base.ts`     | C    |
| `packages/core/src/storage/domains/datasets/inmemory.ts` | F    |
| `packages/core/src/storage/domains/datasets/index.ts`    | L    |
| `stores/libsql/src/storage/domains/datasets/index.ts`    | G    |

### Test Files (5)

| File                                                                    | Task |
| ----------------------------------------------------------------------- | ---- |
| `packages/core/src/datasets/__tests__/trace-capture.test.ts`            | T1   |
| `packages/core/src/storage/domains/datasets/__tests__/inmemory.test.ts` | T2   |
| `packages/core/src/datasets/__tests__/run.test.ts`                      | T3   |
| `stores/libsql/src/storage/domains/datasets/__tests__/index.test.ts`    | T4   |
| `packages/core/src/mastra/__tests__/datasets.test.ts`                   | T5   |

### Modified Files (7)

| File                                               | Task |
| -------------------------------------------------- | ---- |
| `packages/core/src/storage/constants.ts`           | B    |
| `packages/core/src/storage/domains/inmemory-db.ts` | D    |
| `packages/core/src/storage/base.ts`                | I    |
| `packages/core/src/storage/mock.ts`                | J    |
| `stores/libsql/src/storage/index.ts`               | K    |
| `packages/core/src/storage/domains/index.ts`       | O    |
| `packages/core/src/mastra/index.ts`                | M    |

---

## Reference Files

These existing files demonstrate the patterns to follow:

| Pattern                    | Reference File                                         |
| -------------------------- | ------------------------------------------------------ |
| Abstract storage domain    | `packages/core/src/storage/domains/scores/base.ts`     |
| In-memory implementation   | `packages/core/src/storage/domains/scores/inmemory.ts` |
| LibSQL implementation      | `stores/libsql/src/storage/domains/scores/index.ts`    |
| Run orchestration          | `packages/core/src/evals/run/index.ts`                 |
| Shared types/schemas       | `packages/core/src/storage/domains/shared.ts`          |
| Unit tests (evals)         | `packages/core/src/evals/run/index.test.ts`            |
| Integration tests (libsql) | `stores/libsql/src/storage/index.test.ts`              |
| Integration tests (mastra) | `packages/core/src/mastra/*.test.ts`                   |

---

## Verification

After implementation, verify with:

```bash
# Build
pnpm build:core

# Type check
pnpm typecheck

# Unit tests (after adding test files)
cd packages/core && pnpm test

# LibSQL integration tests
cd stores/libsql && pnpm test

# PostgreSQL integration tests (future)
pnpm dev:services:up
cd stores/pg && pnpm test
```

---

## API Examples

### Create and populate a dataset

```typescript
const store = await mastra.getDatasetsStore();

// Create dataset
const dataset = await store.createDataset({
  name: 'qa-golden-set',
  description: 'Golden QA pairs for regression testing',
});

// Add items
await store.createDatasetItems([
  { datasetId: dataset.id, input: 'What is 2+2?', expectedOutput: '4' },
  { datasetId: dataset.id, input: 'Capital of France?', expectedOutput: 'Paris' },
]);
```

### Capture from production trace

```typescript
await mastra.captureTraceToDataset('trace-abc123', {
  datasetId: dataset.id,
  spanFilter: span => span.spanType === 'AGENT_RUN',
});
```

### Run evaluation

```typescript
const result = await mastra.runDataset({
  datasetId: dataset.id,
  target: { type: 'agent', agent: myAgent },
  scorers: [accuracyScorer, coherenceScorer],
  onProgress: (done, total) => console.log(`${done}/${total}`),
});
```

### Point-in-time queries (versioning)

```typescript
// Get dataset state as of yesterday
const { items } = await store.listDatasetItems({
  datasetId: dataset.id,
  asOf: new Date('2024-01-14'),
});
```

---

## Studio Integration Plan

### Overview

Add Dataset management UI to Mastra Studio for manual testing and production use.

### Architecture

```
playground (pages)     → playground-ui (domains)  → server (handlers)  → core (storage)
/datasets              → domains/datasets/        → handlers/datasets  → datasets/
/datasets/:id          → hooks, components        → CRUD routes        → DatasetsStorage
```

### Wave S1: Server API Routes

| Task   | File                                              | Description                  |
| ------ | ------------------------------------------------- | ---------------------------- |
| **S1** | `packages/server/src/server/handlers/datasets.ts` | API route handlers           |
| **S2** | `packages/server/src/server/schemas/datasets.ts`  | Zod request/response schemas |

Routes to implement:

- `GET /api/datasets` - List all datasets
- `POST /api/datasets` - Create dataset
- `GET /api/datasets/:id` - Get dataset by ID
- `PUT /api/datasets/:id` - Update dataset
- `DELETE /api/datasets/:id` - Delete dataset
- `GET /api/datasets/:id/items` - List dataset items
- `POST /api/datasets/:id/items` - Add items to dataset
- `GET /api/datasets/:id/runs` - List dataset runs
- `POST /api/datasets/:id/runs` - Start new run

### Wave S2: Playground UI Domain

| Task   | File                                                      | Description          |
| ------ | --------------------------------------------------------- | -------------------- |
| **S3** | `packages/playground-ui/src/domains/datasets/hooks/`      | TanStack Query hooks |
| **S4** | `packages/playground-ui/src/domains/datasets/components/` | UI components        |

Hooks:

- `useDatasets()` - List datasets
- `useDataset(id)` - Single dataset
- `useDatasetItems(datasetId)` - Dataset items
- `useDatasetRuns(datasetId)` - Dataset runs
- `useCreateDataset()` - Mutation
- `useAddDatasetItems()` - Mutation

Components:

- `DatasetsTable` - List view with pagination
- `DatasetDetail` - Single dataset view
- `DatasetItemsTable` - Items list
- `DatasetRunsTable` - Runs list
- `CreateDatasetDialog` - Creation form
- `AddItemsDialog` - Add items form

### Wave S3: Playground Pages

| Task   | File                                                    | Description         |
| ------ | ------------------------------------------------------- | ------------------- |
| **S5** | `packages/playground/src/pages/datasets/index.tsx`      | Datasets list page  |
| **S6** | `packages/playground/src/pages/datasets/[id]/index.tsx` | Dataset detail page |

### File Summary

| Package       | New Files                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------- |
| server        | `handlers/datasets.ts`, `schemas/datasets.ts`                                                   |
| playground-ui | `domains/datasets/hooks/*.ts`, `domains/datasets/components/*.tsx`, `domains/datasets/index.ts` |
| playground    | `pages/datasets/index.tsx`, `pages/datasets/[id]/index.tsx`                                     |

### Priority

Start with S1 (server routes) to enable API testing via curl/Postman before UI is ready.

---

## Implementation Status

### Completed ✅

| Wave      | Tasks                                                    | Status  |
| --------- | -------------------------------------------------------- | ------- |
| Wave 1    | Types (A)                                                | ✅ Done |
| Wave 2    | Constants, Base, InMemory-DB, Trace-Capture (B, C, D, E) | ✅ Done |
| Wave 3    | InMemory impl, LibSQL impl, Run, Tests (F, G, H, T1)     | ✅ Done |
| Wave 4    | Domain registration, Tests (I, J, K, L, T2, T3)          | ✅ Done |
| Wave 5    | Mastra integration, Index exports, Tests (M, N, T4)      | ✅ Done |
| Wave 6    | Domain exports, Final tests (O, T5)                      | ✅ Done |
| Studio S1 | Server API routes                                        | ✅ Done |
| Studio S2 | Playground UI domain (hooks, components)                 | ✅ Done |
| Studio S3 | Playground pages                                         | ✅ Done |

### Bug Fixes Applied

| Issue                    | Fix                                              |
| ------------------------ | ------------------------------------------------ |
| ClickHouse build error   | Added TABLE_ENGINES entries for dataset tables   |
| Cloudflare build error   | Added RecordTypes entries for dataset types      |
| Date formatting error    | Handle both Date objects and ISO strings         |
| JsonCell undefined error | Added null/undefined check before JSON.stringify |

---

## Remaining Work

### Phase R1: Item Management (Priority: High)

Complete CRUD operations for dataset items in the UI.

| Task     | File                                                          | Description                                                  |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| **R1.1** | `playground-ui/.../dataset-items-table/columns.tsx`           | Add row actions column (edit, delete buttons)                |
| **R1.2** | `playground-ui/.../components/edit-dataset-item-dialog.tsx`   | Edit item dialog (reuse AddDatasetItemDialog pattern)        |
| **R1.3** | `playground-ui/.../components/delete-dataset-item-dialog.tsx` | Delete confirmation dialog                                   |
| **R1.4** | `playground-ui/.../hooks/use-dataset-items.ts`                | Add `useUpdateDatasetItem`, `useDeleteDatasetItem` mutations |
| **R1.5** | `server/handlers/datasets.ts`                                 | Add `PUT /api/datasets/:datasetId/items/:itemId` route       |
| **R1.6** | `server/handlers/datasets.ts`                                 | Add `DELETE /api/datasets/:datasetId/items/:itemId` route    |
| **R1.7** | `client-js/src/client.ts`                                     | Add `updateDatasetItem`, `deleteDatasetItem` methods         |

### Phase R2: Run Execution (Priority: High)

Core evaluation feature - run an agent against a dataset.

| Task     | File                                                  | Description                                             |
| -------- | ----------------------------------------------------- | ------------------------------------------------------- |
| **R2.1** | `playground-ui/.../components/run-dataset-dialog.tsx` | Run configuration dialog (select agent, options)        |
| **R2.2** | `playground-ui/.../hooks/use-dataset-runs.ts`         | Add `useCreateDatasetRun` mutation                      |
| **R2.3** | `server/handlers/datasets.ts`                         | Add `POST /api/datasets/:datasetId/runs` route          |
| **R2.4** | `core/src/datasets/run.ts`                            | Implement `runDataset` orchestration logic              |
| **R2.5** | `core/src/datasets/run.ts`                            | Progress tracking (items completed / total)             |
| **R2.6** | `core/src/datasets/run.ts`                            | Store results per item (actual output, latency, tokens) |
| **R2.7** | `client-js/src/client.ts`                             | Add `createDatasetRun` method                           |

**Key Decisions Needed:**

- Run execution location: Server-side streaming vs client-triggered
- Evaluation criteria: JSON equality vs custom scorer functions
- Agent selection: All registered agents or filtered list

### Phase R3: Runs UI (Priority: Medium)

Display evaluation runs and results.

| Task     | File                                                  | Description                                                  |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| **R3.1** | `playground-ui/.../components/dataset-runs-table/`    | Runs table component (status, agent, duration)               |
| **R3.2** | `playground-ui/.../dataset-information.tsx`           | Add "Runs" tab to dataset detail page                        |
| **R3.3** | `playground/src/pages/datasets/dataset/run/index.tsx` | Run detail page                                              |
| **R3.4** | `playground-ui/.../components/run-results-table/`     | Results table (input, expected, actual, pass/fail)           |
| **R3.5** | `playground-ui/.../components/run-summary.tsx`        | Run summary stats (pass rate, avg latency)                   |
| **R3.6** | `playground-ui/.../hooks/use-dataset-run-results.ts`  | Hook for fetching run results                                |
| **R3.7** | `server/handlers/datasets.ts`                         | Add `GET /api/datasets/:datasetId/runs/:runId/results` route |
| **R3.8** | `client-js/src/client.ts`                             | Add `getDatasetRun`, `listDatasetRunResults` methods         |

### Phase R4: Bulk Import (Priority: Low)

Productivity feature for importing existing data.

| Task     | File                                                           | Description                           |
| -------- | -------------------------------------------------------------- | ------------------------------------- |
| **R4.1** | `playground-ui/.../components/import-dataset-items-dialog.tsx` | Import dialog with file upload        |
| **R4.2** | `playground-ui/.../components/import-dataset-items-dialog.tsx` | JSON array format parser              |
| **R4.3** | `playground-ui/.../components/import-dataset-items-dialog.tsx` | CSV format parser with header mapping |
| **R4.4** | `playground-ui/.../components/import-preview-table.tsx`        | Preview table before import           |
| **R4.5** | `playground-ui/.../components/import-dataset-items-dialog.tsx` | Validation errors display             |

---

## Remaining Work Summary

| Phase               | Tasks  | Priority | Complexity | Est. LOC   |
| ------------------- | ------ | -------- | ---------- | ---------- |
| R1: Item Management | 7      | High     | Low        | ~300       |
| R2: Run Execution   | 7      | High     | High       | ~500       |
| R3: Runs UI         | 8      | Medium   | Medium     | ~600       |
| R4: Bulk Import     | 5      | Low      | Medium     | ~400       |
| **Total**           | **27** |          |            | **~1,800** |

---

## Recommended Implementation Order

```
R1 (Item Management) ──► R2 (Run Execution) ──► R3 (Runs UI) ──► R4 (Bulk Import)
        │                       │                    │
        │                       │                    └── Can display runs
        │                       └── Core feature unlocked
        └── Quick win, fixes UX gap
```

**Rationale:**

1. **R1 first**: Low effort, immediate value, no dependencies
2. **R2 second**: Core feature, unlocks all run-related functionality
3. **R3 third**: Requires R2 to have runs to display
4. **R4 last**: Nice-to-have, users can work around with single adds
