# Phase 1 — Foundation

> Sequential. No runtime behavior changes. Establishes the type foundation for all later phases.

---

## Dependencies

None — this is the first phase.

---

## Task 1a — Rename `Dataset` → `DatasetRecord`

The existing `Dataset` interface (raw storage shape) must be renamed to `DatasetRecord` to free the `Dataset` name for the new user-facing class.

### Files

| File                                                     | Changes                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/core/src/storage/types.ts`                     | Rename `interface Dataset` → `interface DatasetRecord`. Update `ListDatasetsOutput.datasets` type.      |
| `packages/core/src/storage/domains/datasets/base.ts`     | 5 type refs — `createDataset`, `getDatasetById`, `updateDataset`, `_doUpdateDataset` return/param types |
| `packages/core/src/storage/domains/datasets/inmemory.ts` | 6 type refs — `createDataset`, `getDatasetById`, `_doUpdateDataset`, internal `Map<string, Dataset>`    |
| `stores/libsql/src/storage/domains/datasets/index.ts`    | 5 type refs — `transformDatasetRow`, `createDataset`, `getDatasetById`, `_doUpdateDataset`              |
| `packages/core/src/storage/domains/inmemory-db.ts`       | Import at L10, `Map<string, Dataset>` at L43                                                            |
| `client-sdks/client-js/src/types.ts`                     | Rename parallel `Dataset` interface definition (~line 1443)                                             |
| `client-sdks/client-js/src/client.ts`                    | 4 type refs — `getDataset`, `createDataset`, `updateDataset`                                            |
| `packages/playground-ui/src/domains/datasets/`           | 3 files — `columns.tsx`, `datasets-table.tsx`, `add-items-to-dataset-dialog.tsx`                        |

### Approach

1. Rename in `packages/core/src/storage/types.ts` first (the canonical definition).
2. Update all importing files. Use find-and-replace for type annotations: `: Dataset` → `: DatasetRecord`, `Dataset[]` → `DatasetRecord[]`, etc.
3. Be careful **not** to rename `DatasetItem`, `DatasetItemVersion`, `DatasetVersion` — only the bare `Dataset` interface.
4. The `client-sdks/client-js/src/types.ts` has its own independent `Dataset` interface (not imported from core). Rename it the same way.

### Completion Criteria

- [ ] `grep 'interface Dataset ' packages/core/src/storage/types.ts` → **zero matches**
- [ ] `grep 'interface DatasetRecord ' packages/core/src/storage/types.ts` → **1 match**
- [ ] `grep ': Dataset[^IRV]' packages/core/src/storage/` → **zero matches** (no bare `Dataset` type annotations left — only `DatasetRecord`, `DatasetItem`, `DatasetItemVersion`, `DatasetVersion`)
- [ ] `pnpm build:core` passes
- [ ] `pnpm build` passes (libsql, client-js, playground-ui all compile)

---

## Task 1b — Extend experiment types

Add new internal types and extend `ExperimentConfig` with generics and new optional fields.

### Files

| File                                             | Changes                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `packages/core/src/datasets/experiment/types.ts` | Add `DataItem`, extend `ExperimentConfig` with generics, add `StartExperimentConfig` |

### Types to add

```ts
/**
 * A single data item for inline experiment data.
 * Internal — not publicly exported from @mastra/core.
 */
interface DataItem<I = unknown, E = unknown> {
  /** Unique ID (auto-generated if omitted) */
  id?: string;
  /** Input data passed to task */
  input: I;
  /** Ground truth for scoring */
  groundTruth?: E;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### Current `ExperimentConfig` (before changes)

```ts
// packages/core/src/datasets/experiment/types.ts L7-28
interface ExperimentConfig {
  datasetId: string; // REQUIRED — becomes optional
  targetType: TargetType; // REQUIRED — becomes optional
  targetId: string; // REQUIRED — becomes optional
  scorers?: (MastraScorer<any, any, any, any> | string)[];
  version?: Date;
  maxConcurrency?: number;
  signal?: AbortSignal;
  itemTimeout?: number;
  maxRetries?: number; // EXISTS — keep as-is
  runId?: string; // EXISTS — rename to experimentId
}
```

Only consumer: `packages/core/src/datasets/experiment/index.ts` (L5 import, L8 re-export, L38 param type).

### Types to extend

```ts
/**
 * Internal configuration for running a dataset experiment.
 * Not publicly exported — users interact via Dataset.startExperiment().
 * All new fields are optional — existing internal callers are unaffected.
 */
interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  // === Data source (pick one — Dataset always injects datasetId) ===

  /** ID of dataset in storage (injected by Dataset) */
  datasetId?: string; // WAS REQUIRED — now optional
  /** Override data source — inline array or async factory (bypasses storage load) */
  data?: DataItem<I, E>[] | (() => Promise<DataItem<I, E>[]>);

  // === Task execution (pick one) ===

  /** Registry-based target type (existing) */
  targetType?: TargetType; // WAS REQUIRED — now optional
  /** Registry-based target ID (existing) */
  targetId?: string; // WAS REQUIRED — now optional
  /** Inline task function (sync or async) */
  task?: (args: {
    input: I;
    mastra: Mastra;
    groundTruth?: E;
    metadata?: Record<string, unknown>;
    signal?: AbortSignal;
  }) => O | Promise<O>;

  // === Scoring ===

  /** Scorers — MastraScorer instances or string IDs */
  scorers?: (MastraScorer<any, any, any, any> | string)[];

  // === Options ===

  /** Pin to specific dataset version (default: latest). Only applies when datasetId is used. */
  version?: Date;
  /** Maximum concurrent executions (default: 5) */
  maxConcurrency?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Per-item execution timeout in milliseconds */
  itemTimeout?: number;
  /** Maximum retries per item (existing — keep as-is) */
  maxRetries?: number;
  /** Pre-created experiment ID (for async trigger — skips run creation). Renamed from runId. */
  experimentId?: string;
  /** Experiment name (used for display / grouping) */
  name?: string;
}
```

### `runId` → `experimentId` rename

The existing `runId` field on `ExperimentConfig` must be renamed to `experimentId`. This also affects:

- `packages/core/src/datasets/experiment/index.ts` — any usage of `config.runId` → `config.experimentId`

Search for `runId` in the experiment directory to find all references.

### Types to add (public)

```ts
/**
 * Configuration for starting an experiment on a dataset.
 * The dataset is always the data source — no datasetId/data needed.
 *
 * Generic type params are optional. Without them, input/output default to `unknown`
 * and the task callback receives `unknown` — users must cast or narrow manually.
 *
 * With generics:
 *   ds.startExperiment<{ question: string }, { answer: string }>({ task: ... })
 * TypeScript will type-check the task's input and return value.
 */
type StartExperimentConfig<I = unknown, O = unknown, E = unknown> = Omit<
  ExperimentConfig<I, O, E>,
  'datasetId' | 'data' | 'experimentId'
>;
```

### Schema type note

The `inputSchema` and `groundTruthSchema` parameters on `DatasetsManager.create()` and `Dataset.update()` use `JSONSchema7 | ZodType`. This union type is **not** defined here — it's used directly in the manager and dataset class method signatures. Import `JSONSchema7` from `@mastra/schema-compat` and `ZodType` from `zod`.

### Completion Criteria

- [ ] `DataItem`, `ExperimentConfig`, `StartExperimentConfig` all importable from `experiment/types.ts`
- [ ] `ExperimentConfig.datasetId` is optional (`string | undefined`)
- [ ] `ExperimentConfig.task` accepts sync or async functions (`O | Promise<O>`)
- [ ] `ExperimentConfig.task` callback receives `{ input, mastra, groundTruth?, metadata?, signal? }`
- [ ] `ExperimentConfig.runId` renamed to `experimentId` — `grep 'runId' packages/core/src/datasets/experiment/types.ts` → zero matches
- [ ] `ExperimentConfig.maxRetries` preserved (not removed)
- [ ] `StartExperimentConfig` omits `datasetId`, `data`, and `experimentId`
- [ ] `pnpm build:core` passes
- [ ] Existing `runExperiment()` callers see no type errors (all new fields optional, generics default to `unknown`)
