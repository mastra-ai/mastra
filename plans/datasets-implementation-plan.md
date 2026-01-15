# Datasets Feature Implementation Plan

## Overview

Add a Datasets feature to Mastra for storing collections of input/output examples, capturing production traces as dataset items, and running evaluations against datasets.

**Key Features:**
- Timestamp-based versioning (industry standard: Langfuse, LangSmith, Braintrust)
- Trace-to-dataset capture from production
- Dataset run orchestration with scoring
- Pluggable storage (in-memory, PostgreSQL)

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
  sourceTraceId?: string;    // If captured from trace
  sourceSpanId?: string;
  archivedAt?: Date;         // Soft delete for versioning
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
│                  └────► G (pg impl) ────────► K (pg store)
├─► D (inmemory-db) ────► F (inmemory impl)
├─► E (trace-capture)
└─► H (run.ts)

C, F, G ─► I (StorageDomains type)
C ───────► L (domains/index.ts)
I, J, K, L ─► M (mastra integration)
E, H ──────► N (datasets/index.ts)
```

---

## Wave 1: Foundation

**Parallelism:** 1 task (blocking)

| Task | File | Description |
|------|------|-------------|
| **A** | `packages/core/src/datasets/types.ts` | Create Zod schemas and TypeScript types for Dataset, DatasetItem, DatasetRun, DatasetRunResult, and all list/response types |

**Blocked by:** Nothing
**Blocks:** All other tasks

---

## Wave 2: Core Infrastructure

**Parallelism:** 4 tasks in parallel

| Task | File | Description | Depends On |
|------|------|-------------|------------|
| **B** | `packages/core/src/storage/constants.ts` | Add `TABLE_DATASETS`, `TABLE_DATASET_ITEMS`, `TABLE_DATASET_RUNS`, `TABLE_DATASET_RUN_RESULTS` constants and schemas | A |
| **C** | `packages/core/src/storage/domains/datasets/base.ts` | Create abstract `DatasetsStorage` class with all CRUD method signatures | A |
| **D** | `packages/core/src/storage/domains/inmemory-db.ts` | Add `datasets`, `datasetItems`, `datasetRuns`, `datasetRunResults` Maps | A |
| **E** | `packages/core/src/datasets/trace-capture.ts` | Create `captureSpanToDataset`, `captureTraceToDataset`, `captureTracesToDataset` functions | A |

---

## Wave 3: Implementations

**Parallelism:** 3 tasks in parallel

| Task | File | Description | Depends On |
|------|------|-------------|------------|
| **F** | `packages/core/src/storage/domains/datasets/inmemory.ts` | Implement `DatasetsInMemory` class with all CRUD operations, versioning support (`asOf` queries), pagination | C, D |
| **G** | `stores/pg/src/storage/domains/datasets/index.ts` | Implement `DatasetsPG` class with SQL queries, indexes, migrations | C |
| **H** | `packages/core/src/datasets/run.ts` | Create `runDataset` orchestration function | A |

---

## Wave 4: Domain Registration

**Parallelism:** 4 tasks in parallel

| Task | File | Description | Depends On |
|------|------|-------------|------------|
| **I** | `packages/core/src/storage/base.ts` | Add `datasets?: DatasetsStorage` to `StorageDomains` type, update `init()` | C |
| **J** | `packages/core/src/storage/mock.ts` | Instantiate `DatasetsInMemory` in `InMemoryStore.stores` | F |
| **K** | `stores/pg/src/storage/index.ts` | Instantiate `DatasetsPG` in `PostgresStore.stores` | G |
| **L** | `packages/core/src/storage/domains/datasets/index.ts` | Create index file exporting `base.ts` and `inmemory.ts` | C, F |

---

## Wave 5: Integration

**Parallelism:** 2 tasks in parallel

| Task | File | Description | Depends On |
|------|------|-------------|------------|
| **M** | `packages/core/src/mastra/index.ts` | Add `captureSpanToDataset()`, `captureTraceToDataset()`, `runDataset()`, `getDatasetsStore()` methods | I, J, K, L |
| **N** | `packages/core/src/datasets/index.ts` | Create package index exporting types, trace-capture, and run | E, H |

---

## Wave 6: Domain Exports

**Parallelism:** 1 task

| Task | File | Description | Depends On |
|------|------|-------------|------------|
| **O** | `packages/core/src/storage/domains/index.ts` | Add `export * from './datasets'` | L |

---

## Summary Table

| Wave | Tasks | Parallel? | Complexity | Estimated LOC |
|------|-------|-----------|------------|---------------|
| 1 | A | No | Medium | ~200 |
| 2 | B, C, D, E | Yes (4) | Medium | ~50, ~80, ~20, ~100 |
| 3 | F, G, H | Yes (3) | High | ~250, ~400, ~150 |
| 4 | I, J, K, L | Yes (4) | Low | ~20, ~10, ~10, ~5 |
| 5 | M, N | Yes (2) | Medium | ~80, ~10 |
| 6 | O | No | Low | ~2 |

**Total: 15 discrete tasks, 6 waves, ~1,400 LOC**

---

## File Summary

### New Files (9)

| File | Task |
|------|------|
| `packages/core/src/datasets/types.ts` | A |
| `packages/core/src/datasets/trace-capture.ts` | E |
| `packages/core/src/datasets/run.ts` | H |
| `packages/core/src/datasets/index.ts` | N |
| `packages/core/src/storage/domains/datasets/base.ts` | C |
| `packages/core/src/storage/domains/datasets/inmemory.ts` | F |
| `packages/core/src/storage/domains/datasets/index.ts` | L |
| `stores/pg/src/storage/domains/datasets/index.ts` | G |

### Modified Files (6)

| File | Task |
|------|------|
| `packages/core/src/storage/constants.ts` | B |
| `packages/core/src/storage/domains/inmemory-db.ts` | D |
| `packages/core/src/storage/base.ts` | I |
| `packages/core/src/storage/mock.ts` | J |
| `stores/pg/src/storage/index.ts` | K |
| `packages/core/src/storage/domains/index.ts` | O |
| `packages/core/src/mastra/index.ts` | M |

---

## Reference Files

These existing files demonstrate the patterns to follow:

| Pattern | Reference File |
|---------|----------------|
| Abstract storage domain | `packages/core/src/storage/domains/scores/base.ts` |
| In-memory implementation | `packages/core/src/storage/domains/scores/inmemory.ts` |
| PostgreSQL implementation | `stores/pg/src/storage/domains/scores/index.ts` |
| Run orchestration | `packages/core/src/evals/run/index.ts` |
| Shared types/schemas | `packages/core/src/storage/domains/shared.ts` |

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

# PostgreSQL integration tests
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
  description: 'Golden QA pairs for regression testing'
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
