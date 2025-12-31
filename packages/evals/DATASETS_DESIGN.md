# Mastra Datasets Feature Design

## Overview

This document outlines the design for introducing a datasets feature to Mastra's evaluation system. Datasets provide a structured way to manage test cases, enable reproducible evaluations, and track evaluation results over time.

---

## Research: External Implementations

### Langfuse

**Source:** https://langfuse.com/docs/evaluation/experiments/datasets

- **Dataset**: A collection of inputs and expected outputs used to test applications
- **Dataset Items**: Individual test cases with input, expected_output, metadata, status (ACTIVE/ARCHIVED)
- **Features**:
  - Schema enforcement via JSON Schema validation
  - Folder organization using forward slashes in names
  - Items can link to production traces (source_trace_id, source_observation_id)
  - CSV import functionality
  - Synthetic dataset generation via LLM prompting
- **Workflow**: Create test cases → Run evaluations → Evaluate performance → Compare results

### Braintrust

**Source:** https://www.braintrust.dev/docs/core/datasets

- **Key Properties**:
  - Integrated with evaluations and playground
  - Versioned (every modification tracked, evaluations can pin to specific versions)
  - Scalable (cloud data warehouse infrastructure)
  - Secure (self-hosted option)
- **Data Structure**: Records as JSON with `input`, `expected` (optional), `metadata` (optional)
- **Operations**: Create, Read, Insert, Update (merge strategy), Delete, Query (BTQL filtering)
- **Evaluation Integration**:
  - Pass directly to `Eval()` function
  - Convert evaluation results to datasets via `asDataset()`
  - Log dataset record IDs to link results
- **Multimodal Support**: Images via URLs, base64, attachments, or external object stores

### Arize Phoenix

**Source:** https://arize.com/docs/phoenix/datasets-and-experiments/concepts-datasets

- **Structure**: Each example has `inputs` dict, optional `output` dict, optional `metadata` dict
- **Dataset Types**:
  - Key-Value Pairs (multiple inputs/outputs for RAG, multi-parameter functions)
  - LLM Inputs/Outputs (single string input/response)
  - Messages/Chat (structured message formats with role and content)
- **Features**:
  - Versioned (insert/update/delete creates version history)
  - Evaluations pinned to specific dataset versions
  - Integrated with production spans

### Summary Comparison

| Feature                  | Langfuse                         | Braintrust                   | Arize Phoenix               |
| ------------------------ | -------------------------------- | ---------------------------- | --------------------------- |
| **Core Structure**       | Dataset → Items                  | Dataset → Records            | Dataset → Examples          |
| **Item Fields**          | input, expected_output, metadata | input, expected, metadata    | inputs, output, metadata    |
| **Versioning**           | Yes                              | Yes (pin to version in SDK)  | Yes                         |
| **Status**               | ACTIVE/ARCHIVED                  | No                           | No                          |
| **Schema Validation**    | JSON Schema                      | No                           | No                          |
| **Evaluations**          | Runs linked to dataset           | Evals pin to dataset version | Evaluations tied to dataset |
| **Production Traces**    | Link items to traces             | Convert evaluation → dataset | Link spans to dataset       |
| **Folders/Organization** | Forward slash naming             | Project-based                | No                          |
| **Multimodal**           | No                               | Yes (images, files)          | No                          |

---

## Proposed Design for Mastra

### Core Concepts

1. **Dataset** - A named, versioned collection of test cases
2. **Dataset Item** - Individual test case with input/expectedOutput/metadata
3. **Dataset Version** - Immutable snapshot for reproducible evaluations
4. **Evaluation** - An evaluation run against a specific dataset version

---

## Data Model

### Dataset

```typescript
interface Dataset {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  schema?: {
    input?: JSONSchema; // Optional schema validation
    expectedOutput?: JSONSchema;
  };
  currentVersion: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}
```

### Dataset Item

```typescript
interface DatasetItem {
  id: string;
  datasetId: string;
  input: Record<string, any>; // Flexible JSON input
  expectedOutput?: Record<string, any>; // Ground truth
  metadata?: Record<string, any>; // Tags, source info
  sourceTraceId?: string; // Link to production trace
  sourceSpanId?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}
```

### Dataset Version

```typescript
interface DatasetVersion {
  id: string;
  datasetId: string;
  version: number;
  itemIds: string[]; // Snapshot of item IDs at this version
  itemCount: number;
  createdAt: Date;
  description?: string; // Version notes
}
```

### Evaluation

```typescript
interface Evaluation {
  id: string;
  name: string;
  datasetId: string;
  datasetVersionId: string; // Pinned to specific version
  scorerIds: string[]; // Which scorers were used
  entityType: 'AGENT' | 'WORKFLOW';
  entityId: string; // Agent/workflow name
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  metadata?: Record<string, any>;
  summary?: {
    totalItems: number;
    completedItems: number;
    scores: Record<string, number>; // Aggregated scores per scorer
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

### Evaluation Result

```typescript
interface EvaluationResult {
  id: string;
  evaluationId: string;
  datasetItemId: string;
  runId: string; // Links to scorer runs
  output: any; // Actual output from agent/workflow
  scores: Record<
    string,
    {
      scorerId: string;
      score: number;
      reason?: string;
    }
  >;
  latencyMs?: number;
  error?: string;
  createdAt: Date;
}
```

---

## Storage Schema

Following existing patterns in `packages/core/src/storage/constants.ts`:

```typescript
export const TABLE_DATASETS = 'mastra_datasets';
export const TABLE_DATASET_ITEMS = 'mastra_dataset_items';
export const TABLE_DATASET_VERSIONS = 'mastra_dataset_versions';
export const TABLE_EVALUATIONS = 'mastra_evaluations';
export const TABLE_EVALUATION_RESULTS = 'mastra_evaluation_results';

export const DATASET_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  schema: { type: 'jsonb', nullable: true },
  currentVersion: { type: 'integer', nullable: false },
  status: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_ITEM_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  input: { type: 'jsonb', nullable: false },
  expectedOutput: { type: 'jsonb', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  sourceTraceId: { type: 'text', nullable: true },
  sourceSpanId: { type: 'text', nullable: true },
  status: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_VERSION_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  version: { type: 'integer', nullable: false },
  itemIds: { type: 'jsonb', nullable: false },
  itemCount: { type: 'integer', nullable: false },
  description: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const EVALUATION_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  datasetId: { type: 'text', nullable: false },
  datasetVersionId: { type: 'text', nullable: false },
  scorerIds: { type: 'jsonb', nullable: false },
  entityType: { type: 'text', nullable: false },
  entityId: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  metadata: { type: 'jsonb', nullable: true },
  summary: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
  completedAt: { type: 'timestamp', nullable: true },
};

export const EVALUATION_RESULT_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  evaluationId: { type: 'text', nullable: false },
  datasetItemId: { type: 'text', nullable: false },
  runId: { type: 'text', nullable: false },
  output: { type: 'jsonb', nullable: true },
  scores: { type: 'jsonb', nullable: false },
  latencyMs: { type: 'integer', nullable: true },
  error: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};
```

---

## API Design

### DatasetManager (accessed via `mastra.datasets`)

```typescript
class DatasetManager {
  // Dataset CRUD
  create(params: CreateDatasetParams): Promise<Dataset>;
  get(id: string): Promise<Dataset | null>;
  getByName(name: string): Promise<Dataset | null>;
  list(params?: ListParams): Promise<Dataset[]>;
}
```

### Dataset Instance (returned by `datasets.create()` or `datasets.get()`)

```typescript
class Dataset {
  // Properties
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly currentVersion: number;
  readonly status: 'ACTIVE' | 'ARCHIVED';

  // Dataset mutations
  update(updates: UpdateDatasetParams): Promise<Dataset>;
  archive(): Promise<void>;

  // Item Operations (each mutation auto-increments version)
  addItems(items: CreateItemParams[]): Promise<{ items: DatasetItem[]; version: DatasetVersion }>;
  getItem(itemId: string): Promise<DatasetItem | null>;
  listItems(params?: ListParams): Promise<DatasetItem[]>;
  updateItem(itemId: string, updates: UpdateItemParams): Promise<{ item: DatasetItem; version: DatasetVersion }>;
  archiveItems(itemIds: string[]): Promise<{ version: DatasetVersion }>;

  // Async iteration for large datasets
  iterateItems(options?: { batchSize?: number; version?: number }): AsyncIterable<DatasetItem>;

  // Version Operations (read-only, versions created automatically)
  getVersion(version: number): Promise<DatasetVersion | null>;
  listVersions(): Promise<DatasetVersion[]>;
  getVersionItems(version: number, params?: ListParams): Promise<DatasetItem[]>;
  iterateVersionItems(version: number, options?: { batchSize?: number }): AsyncIterable<DatasetItem>;

  // Import/Export
  importFromCSV(csv: string, mapping?: FieldMapping): Promise<{ items: DatasetItem[]; version: DatasetVersion }>;
  importFromJSON(items: any[]): Promise<{ items: DatasetItem[]; version: DatasetVersion }>;
  exportToJSON(version?: number): Promise<any[]>;

  // Trace Integration
  addItemFromTrace(traceId: string, spanId?: string): Promise<{ item: DatasetItem; version: DatasetVersion }>;
  addItemsFromTraces(traces: TraceRef[]): Promise<{ items: DatasetItem[]; version: DatasetVersion }>;
}
```

### EvaluationRunner

```typescript
class EvaluationRunner {
  runEvaluation(params: {
    name: string;
    dataset: string | Dataset;
    version?: number; // Defaults to latest
    target: Agent | Workflow;
    scorers: MastraScorer[];
    concurrency?: number;
    onItemComplete?: (result: EvaluationResult) => void;
  }): Promise<Evaluation>;

  getEvaluation(id: string): Promise<Evaluation | null>;
  listEvaluations(datasetId?: string): Promise<Evaluation[]>;
  getEvaluationResults(evaluationId: string): Promise<EvaluationResult[]>;

  // Compare evaluations
  compareEvaluations(evaluationIds: string[]): Promise<EvaluationComparison>;
}
```

---

## Usage Examples

### Basic Usage

```typescript
const mastra = new Mastra({
  storage: myStorage,
  scorers: { relevance, completeness },
});

// Access dataset manager
const datasets = mastra.datasets;

// Create a dataset (starts at version 0)
const dataset = await datasets.create({
  name: 'qa-golden-set',
  description: 'Curated Q&A pairs for regression testing',
  schema: {
    input: { type: 'object', properties: { question: { type: 'string' } } },
    expectedOutput: { type: 'object', properties: { answer: { type: 'string' } } },
  },
});

// Add items - automatically creates version 1
const { items, version } = await dataset.addItems([
  { input: { question: 'What is AI?' }, expectedOutput: { answer: '...' } },
  { input: { question: 'Explain ML' }, expectedOutput: { answer: '...' } },
]);
console.log(`Added ${items.length} items, now at version ${version.version}`);

// Run evaluation (pins to current version automatically)
const evaluation = await mastra.runEvaluation({
  name: 'gpt-4-test',
  dataset: dataset.id,
  target: myAgent,
  scorers: [relevance, completeness],
});

// Or pin to a specific version
const evaluationV1 = await mastra.runEvaluation({
  name: 'gpt-4-test-v1',
  dataset: dataset.id,
  version: 1, // Pin to version 1
  target: myAgent,
  scorers: [relevance, completeness],
});
```

### Integration with Existing runEvals

```typescript
// Current approach (inline data)
await runEvals({
  target: agent,
  scorers: [relevance, completeness],
  data: [
    { input: '...', groundTruth: '...' },
    { input: '...', groundTruth: '...' },
  ],
});

// New approach (dataset-based)
await runEvaluation({
  name: 'v2-prompt-test',
  dataset: 'qa-golden-set',
  version: 3, // Pin to specific version
  target: agent,
  scorers: [relevance, completeness],
});

// Or use dataset directly in runEvals
const dataset = await mastra.getDataset('qa-golden-set');
const items = await dataset.getItems();

await runEvals({
  target: agent,
  scorers: [relevance, completeness],
  data: items.map(i => ({
    input: i.input,
    groundTruth: i.expectedOutput,
  })),
});
```

### Creating Dataset from Production Traces

```typescript
// Create golden set from successful production runs
const traces = await mastra.storage.getTraces({
  filter: { status: 'success', score: { $gte: 0.9 } },
  limit: 100,
});

await datasets.createItemsFromTraces(
  dataset.id,
  traces.map(t => ({
    traceId: t.traceId,
    spanId: t.spanId,
  })),
);
```

---

## Implementation Plan

---

### STEP 1: Foundation

**Goal:** Define all TypeScript types and database schemas.

**Parallel Execution:** Two agents can work on these simultaneously.

---

#### STEP 1A: Storage Schemas (`constants.ts`)

**File:** `packages/core/src/storage/constants.ts`

**Task:** Add table constants and schema definitions for datasets feature.

**Instructions:**

1. Add the following table name constants after the existing constants (around line 9):

```typescript
export const TABLE_DATASETS = 'mastra_datasets';
export const TABLE_DATASET_ITEMS = 'mastra_dataset_items';
export const TABLE_DATASET_VERSIONS = 'mastra_dataset_versions';
export const TABLE_EVALUATIONS = 'mastra_evaluations';
export const TABLE_EVALUATION_RESULTS = 'mastra_evaluation_results';
```

2. Update the `TABLE_NAMES` type union to include the new tables:

```typescript
export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_SPANS
  | typeof TABLE_DATASETS
  | typeof TABLE_DATASET_ITEMS
  | typeof TABLE_DATASET_VERSIONS
  | typeof TABLE_EVALUATIONS
  | typeof TABLE_EVALUATION_RESULTS;
```

3. Add the schema definitions (before `TABLE_SCHEMAS`):

```typescript
export const DATASET_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  schema: { type: 'jsonb', nullable: true },
  currentVersion: { type: 'integer', nullable: false },
  status: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_ITEM_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  input: { type: 'jsonb', nullable: false },
  expectedOutput: { type: 'jsonb', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  sourceTraceId: { type: 'text', nullable: true },
  sourceSpanId: { type: 'text', nullable: true },
  status: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_VERSION_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  version: { type: 'integer', nullable: false },
  itemIds: { type: 'jsonb', nullable: false },
  itemCount: { type: 'integer', nullable: false },
  description: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const EVALUATION_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  datasetId: { type: 'text', nullable: false },
  datasetVersionId: { type: 'text', nullable: false },
  scorerIds: { type: 'jsonb', nullable: false },
  entityType: { type: 'text', nullable: false },
  entityId: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  metadata: { type: 'jsonb', nullable: true },
  summary: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
  completedAt: { type: 'timestamp', nullable: true },
};

export const EVALUATION_RESULT_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  evaluationId: { type: 'text', nullable: false },
  datasetItemId: { type: 'text', nullable: false },
  runId: { type: 'text', nullable: false },
  output: { type: 'jsonb', nullable: true },
  scores: { type: 'jsonb', nullable: false },
  latencyMs: { type: 'integer', nullable: true },
  error: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};
```

4. Add the new schemas to `TABLE_SCHEMAS` object:

```typescript
export const TABLE_SCHEMAS: Record<TABLE_NAMES, Record<string, StorageColumn>> = {
  // ... existing entries ...
  [TABLE_DATASETS]: DATASET_SCHEMA,
  [TABLE_DATASET_ITEMS]: DATASET_ITEM_SCHEMA,
  [TABLE_DATASET_VERSIONS]: DATASET_VERSION_SCHEMA,
  [TABLE_EVALUATIONS]: EVALUATION_SCHEMA,
  [TABLE_EVALUATION_RESULTS]: EVALUATION_RESULT_SCHEMA,
};
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors
- Run `pnpm typecheck` in packages/core

---

#### STEP 1B: TypeScript Interfaces (`types.ts`)

**File:** `packages/core/src/evals/types.ts`

**Task:** Add TypeScript interfaces for datasets, items, versions, evaluations, and results.

**Instructions:**

1. First, read the existing `types.ts` file to understand the current structure.

2. Add the following type definitions (add near the end of the file, before any existing exports):

```typescript
// =============================================================================
// Dataset Types
// =============================================================================

export type DatasetStatus = 'ACTIVE' | 'ARCHIVED';

export interface DatasetData {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  schema?: {
    input?: Record<string, unknown>; // JSON Schema
    expectedOutput?: Record<string, unknown>; // JSON Schema
  };
  currentVersion: number;
  status: DatasetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItemData {
  id: string;
  datasetId: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string;
  sourceSpanId?: string;
  status: DatasetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetVersionData {
  id: string;
  datasetId: string;
  version: number;
  itemIds: string[];
  itemCount: number;
  description?: string;
  createdAt: Date;
}

// =============================================================================
// Evaluation Types
// =============================================================================

export type EvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type EvaluationEntityType = 'AGENT' | 'WORKFLOW';

export interface EvaluationSummary {
  totalItems: number;
  completedItems: number;
  failedItems: number;
  scores: Record<string, number>; // Aggregated scores per scorer
}

export interface EvaluationData {
  id: string;
  name: string;
  datasetId: string;
  datasetVersionId: string;
  scorerIds: string[];
  entityType: EvaluationEntityType;
  entityId: string;
  status: EvaluationStatus;
  metadata?: Record<string, unknown>;
  summary?: EvaluationSummary;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface EvaluationResultScore {
  scorerId: string;
  score: number;
  reason?: string;
}

export interface EvaluationResultData {
  id: string;
  evaluationId: string;
  datasetItemId: string;
  runId: string;
  output?: unknown;
  scores: Record<string, EvaluationResultScore>;
  latencyMs?: number;
  error?: string;
  createdAt: Date;
}

// =============================================================================
// Dataset Operation Params
// =============================================================================

export interface CreateDatasetParams {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  schema?: {
    input?: Record<string, unknown>;
    expectedOutput?: Record<string, unknown>;
  };
}

export interface UpdateDatasetParams {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  schema?: {
    input?: Record<string, unknown>;
    expectedOutput?: Record<string, unknown>;
  };
}

export interface CreateDatasetItemParams {
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string;
  sourceSpanId?: string;
}

export interface UpdateDatasetItemParams {
  input?: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Evaluation Operation Params
// =============================================================================

export interface CreateEvaluationParams {
  name: string;
  datasetId: string;
  datasetVersionId: string;
  scorerIds: string[];
  entityType: EvaluationEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEvaluationParams {
  status?: EvaluationStatus;
  summary?: EvaluationSummary;
  completedAt?: Date;
}

export interface CreateEvaluationResultParams {
  evaluationId: string;
  datasetItemId: string;
  runId: string;
  output?: unknown;
  scores: Record<string, EvaluationResultScore>;
  latencyMs?: number;
  error?: string;
}

// =============================================================================
// List/Query Params
// =============================================================================

export interface DatasetListParams {
  page?: number;
  perPage?: number;
  status?: DatasetStatus;
}

export interface DatasetItemListParams {
  page?: number;
  perPage?: number;
  status?: DatasetStatus;
}

export interface IterateItemsOptions {
  batchSize?: number;
  version?: number;
}

export interface TraceRef {
  traceId: string;
  spanId?: string;
}

export interface FieldMapping {
  input?: string | string[];
  expectedOutput?: string | string[];
  metadata?: string | string[];
}
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors
- Run `pnpm typecheck` in packages/core

---

### STEP 2: Storage Layer

**Goal:** Implement the storage abstraction for datasets.

**Parallel Execution:** Two agents can work on these after STEP 2A (base.ts) is complete.

**Dependencies:** STEP 1A and STEP 1B must be completed first.

---

#### STEP 2A: Abstract Storage Class (`base.ts`)

**File:** `packages/core/src/storage/domains/datasets/base.ts`

**Task:** Create the abstract base class defining the storage interface.

**Instructions:**

1. Create the directory structure:

   ```
   packages/core/src/storage/domains/datasets/
   ```

2. Create `base.ts` with the following content:

```typescript
import { MastraBase } from '../../../base';
import type {
  CreateDatasetParams,
  CreateDatasetItemParams,
  CreateEvaluationParams,
  CreateEvaluationResultParams,
  DatasetData,
  DatasetItemData,
  DatasetVersionData,
  EvaluationData,
  EvaluationResultData,
  UpdateDatasetParams,
  UpdateDatasetItemParams,
  UpdateEvaluationParams,
  DatasetStatus,
} from '../../../evals/types';
import type { PaginationInfo, StoragePagination } from '../../types';

export abstract class DatasetStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'DATASETS',
    });
  }

  // ==========================================================================
  // Dataset CRUD
  // ==========================================================================

  abstract createDataset(params: CreateDatasetParams): Promise<DatasetData>;

  abstract getDataset(id: string): Promise<DatasetData | null>;

  abstract getDatasetByName(name: string): Promise<DatasetData | null>;

  abstract listDatasets(params: {
    pagination: StoragePagination;
    status?: DatasetStatus;
  }): Promise<{ datasets: DatasetData[]; pagination: PaginationInfo }>;

  abstract updateDataset(id: string, updates: UpdateDatasetParams): Promise<DatasetData>;

  abstract archiveDataset(id: string): Promise<void>;

  // ==========================================================================
  // Dataset Item CRUD
  // ==========================================================================

  abstract addItems(datasetId: string, items: CreateDatasetItemParams[]): Promise<DatasetItemData[]>;

  abstract getItem(id: string): Promise<DatasetItemData | null>;

  abstract listItems(params: {
    datasetId: string;
    pagination: StoragePagination;
    status?: DatasetStatus;
  }): Promise<{ items: DatasetItemData[]; pagination: PaginationInfo }>;

  abstract updateItem(id: string, updates: UpdateDatasetItemParams): Promise<DatasetItemData>;

  abstract archiveItems(ids: string[]): Promise<void>;

  // ==========================================================================
  // Version Management (auto-created on mutations)
  // ==========================================================================

  abstract createVersion(params: {
    datasetId: string;
    version: number;
    itemIds: string[];
    description?: string;
  }): Promise<DatasetVersionData>;

  abstract getVersion(id: string): Promise<DatasetVersionData | null>;

  abstract getVersionByNumber(datasetId: string, version: number): Promise<DatasetVersionData | null>;

  abstract listVersions(datasetId: string): Promise<DatasetVersionData[]>;

  abstract getItemsByVersionId(params: {
    versionId: string;
    pagination: StoragePagination;
  }): Promise<{ items: DatasetItemData[]; pagination: PaginationInfo }>;

  // ==========================================================================
  // Evaluation CRUD
  // ==========================================================================

  abstract createEvaluation(params: CreateEvaluationParams): Promise<EvaluationData>;

  abstract getEvaluation(id: string): Promise<EvaluationData | null>;

  abstract listEvaluations(params: {
    datasetId?: string;
    pagination: StoragePagination;
  }): Promise<{ evaluations: EvaluationData[]; pagination: PaginationInfo }>;

  abstract updateEvaluation(id: string, updates: UpdateEvaluationParams): Promise<EvaluationData>;

  // ==========================================================================
  // Evaluation Results
  // ==========================================================================

  abstract saveEvaluationResult(params: CreateEvaluationResultParams): Promise<EvaluationResultData>;

  abstract listEvaluationResults(params: {
    evaluationId: string;
    pagination: StoragePagination;
  }): Promise<{ results: EvaluationResultData[]; pagination: PaginationInfo }>;
}
```

3. Create `packages/core/src/storage/domains/datasets/index.ts`:

```typescript
export * from './base';
export * from './inmemory';
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors

---

#### STEP 2B: In-Memory Implementation (`inmemory.ts`)

**File:** `packages/core/src/storage/domains/datasets/inmemory.ts`

**Task:** Implement the in-memory storage adapter.

**Dependencies:** STEP 2A must be completed first.

**Instructions:**

1. Read `packages/core/src/storage/domains/scores/inmemory.ts` for reference patterns.

2. Create `inmemory.ts` with the following structure:

```typescript
import type {
  CreateDatasetParams,
  CreateDatasetItemParams,
  CreateEvaluationParams,
  CreateEvaluationResultParams,
  DatasetData,
  DatasetItemData,
  DatasetVersionData,
  EvaluationData,
  EvaluationResultData,
  UpdateDatasetParams,
  UpdateDatasetItemParams,
  UpdateEvaluationParams,
  DatasetStatus,
} from '../../../evals/types';
import { calculatePagination, normalizePerPage } from '../../base';
import type { PaginationInfo, StoragePagination } from '../../types';
import { DatasetStorage } from './base';

export type InMemoryDatasets = Map<string, DatasetData>;
export type InMemoryDatasetItems = Map<string, DatasetItemData>;
export type InMemoryDatasetVersions = Map<string, DatasetVersionData>;
export type InMemoryEvaluations = Map<string, EvaluationData>;
export type InMemoryEvaluationResults = Map<string, EvaluationResultData>;

export interface DatasetInMemoryCollections {
  datasets: InMemoryDatasets;
  items: InMemoryDatasetItems;
  versions: InMemoryDatasetVersions;
  evaluations: InMemoryEvaluations;
  results: InMemoryEvaluationResults;
}

export class DatasetInMemory extends DatasetStorage {
  private datasets: InMemoryDatasets;
  private items: InMemoryDatasetItems;
  private versions: InMemoryDatasetVersions;
  private evaluations: InMemoryEvaluations;
  private results: InMemoryEvaluationResults;

  constructor({ collections }: { collections: DatasetInMemoryCollections }) {
    super();
    this.datasets = collections.datasets;
    this.items = collections.items;
    this.versions = collections.versions;
    this.evaluations = collections.evaluations;
    this.results = collections.results;
  }

  // ==========================================================================
  // Dataset CRUD
  // ==========================================================================

  async createDataset(params: CreateDatasetParams): Promise<DatasetData> {
    const now = new Date();
    const dataset: DatasetData = {
      id: crypto.randomUUID(),
      name: params.name,
      description: params.description,
      metadata: params.metadata,
      schema: params.schema,
      currentVersion: 0,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  async getDataset(id: string): Promise<DatasetData | null> {
    return this.datasets.get(id) ?? null;
  }

  async getDatasetByName(name: string): Promise<DatasetData | null> {
    for (const dataset of this.datasets.values()) {
      if (dataset.name === name && dataset.status === 'ACTIVE') {
        return dataset;
      }
    }
    return null;
  }

  async listDatasets(params: {
    pagination: StoragePagination;
    status?: DatasetStatus;
  }): Promise<{ datasets: DatasetData[]; pagination: PaginationInfo }> {
    const { pagination, status } = params;
    let datasets = Array.from(this.datasets.values());

    if (status) {
      datasets = datasets.filter(d => d.status === status);
    }

    datasets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? datasets.length : start + perPage;

    return {
      datasets: datasets.slice(start, end),
      pagination: {
        total: datasets.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : datasets.length > end,
      },
    };
  }

  async updateDataset(id: string, updates: UpdateDatasetParams): Promise<DatasetData> {
    const dataset = this.datasets.get(id);
    if (!dataset) {
      throw new Error(`Dataset not found: ${id}`);
    }

    const updated: DatasetData = {
      ...dataset,
      ...updates,
      updatedAt: new Date(),
    };
    this.datasets.set(id, updated);
    return updated;
  }

  async archiveDataset(id: string): Promise<void> {
    const dataset = this.datasets.get(id);
    if (!dataset) {
      throw new Error(`Dataset not found: ${id}`);
    }

    dataset.status = 'ARCHIVED';
    dataset.updatedAt = new Date();
    this.datasets.set(id, dataset);
  }

  // ==========================================================================
  // Dataset Item CRUD
  // ==========================================================================

  async addItems(datasetId: string, itemParams: CreateDatasetItemParams[]): Promise<DatasetItemData[]> {
    const now = new Date();
    const newItems: DatasetItemData[] = [];

    for (const params of itemParams) {
      const item: DatasetItemData = {
        id: crypto.randomUUID(),
        datasetId,
        input: params.input,
        expectedOutput: params.expectedOutput,
        metadata: params.metadata,
        sourceTraceId: params.sourceTraceId,
        sourceSpanId: params.sourceSpanId,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      this.items.set(item.id, item);
      newItems.push(item);
    }

    return newItems;
  }

  async getItem(id: string): Promise<DatasetItemData | null> {
    return this.items.get(id) ?? null;
  }

  async listItems(params: {
    datasetId: string;
    pagination: StoragePagination;
    status?: DatasetStatus;
  }): Promise<{ items: DatasetItemData[]; pagination: PaginationInfo }> {
    const { datasetId, pagination, status } = params;
    let items = Array.from(this.items.values()).filter(i => i.datasetId === datasetId);

    if (status) {
      items = items.filter(i => i.status === status);
    }

    items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? items.length : start + perPage;

    return {
      items: items.slice(start, end),
      pagination: {
        total: items.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : items.length > end,
      },
    };
  }

  async updateItem(id: string, updates: UpdateDatasetItemParams): Promise<DatasetItemData> {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`Dataset item not found: ${id}`);
    }

    const updated: DatasetItemData = {
      ...item,
      ...updates,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async archiveItems(ids: string[]): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      const item = this.items.get(id);
      if (item) {
        item.status = 'ARCHIVED';
        item.updatedAt = now;
        this.items.set(id, item);
      }
    }
  }

  // ==========================================================================
  // Version Management
  // ==========================================================================

  async createVersion(params: {
    datasetId: string;
    version: number;
    itemIds: string[];
    description?: string;
  }): Promise<DatasetVersionData> {
    const version: DatasetVersionData = {
      id: crypto.randomUUID(),
      datasetId: params.datasetId,
      version: params.version,
      itemIds: params.itemIds,
      itemCount: params.itemIds.length,
      description: params.description,
      createdAt: new Date(),
    };
    this.versions.set(version.id, version);
    return version;
  }

  async getVersion(id: string): Promise<DatasetVersionData | null> {
    return this.versions.get(id) ?? null;
  }

  async getVersionByNumber(datasetId: string, versionNumber: number): Promise<DatasetVersionData | null> {
    for (const version of this.versions.values()) {
      if (version.datasetId === datasetId && version.version === versionNumber) {
        return version;
      }
    }
    return null;
  }

  async listVersions(datasetId: string): Promise<DatasetVersionData[]> {
    const versions = Array.from(this.versions.values())
      .filter(v => v.datasetId === datasetId)
      .sort((a, b) => b.version - a.version);
    return versions;
  }

  async getItemsByVersionId(params: {
    versionId: string;
    pagination: StoragePagination;
  }): Promise<{ items: DatasetItemData[]; pagination: PaginationInfo }> {
    const { versionId, pagination } = params;
    const version = this.versions.get(versionId);
    if (!version) {
      return {
        items: [],
        pagination: { total: 0, page: 0, perPage: pagination.perPage || 10, hasMore: false },
      };
    }

    const items = version.itemIds
      .map(id => this.items.get(id))
      .filter((item): item is DatasetItemData => item !== undefined);

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? items.length : start + perPage;

    return {
      items: items.slice(start, end),
      pagination: {
        total: items.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : items.length > end,
      },
    };
  }

  // ==========================================================================
  // Evaluation CRUD
  // ==========================================================================

  async createEvaluation(params: CreateEvaluationParams): Promise<EvaluationData> {
    const now = new Date();
    const evaluation: EvaluationData = {
      id: crypto.randomUUID(),
      name: params.name,
      datasetId: params.datasetId,
      datasetVersionId: params.datasetVersionId,
      scorerIds: params.scorerIds,
      entityType: params.entityType,
      entityId: params.entityId,
      status: 'PENDING',
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.evaluations.set(evaluation.id, evaluation);
    return evaluation;
  }

  async getEvaluation(id: string): Promise<EvaluationData | null> {
    return this.evaluations.get(id) ?? null;
  }

  async listEvaluations(params: {
    datasetId?: string;
    pagination: StoragePagination;
  }): Promise<{ evaluations: EvaluationData[]; pagination: PaginationInfo }> {
    const { datasetId, pagination } = params;
    let evaluations = Array.from(this.evaluations.values());

    if (datasetId) {
      evaluations = evaluations.filter(e => e.datasetId === datasetId);
    }

    evaluations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? evaluations.length : start + perPage;

    return {
      evaluations: evaluations.slice(start, end),
      pagination: {
        total: evaluations.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : evaluations.length > end,
      },
    };
  }

  async updateEvaluation(id: string, updates: UpdateEvaluationParams): Promise<EvaluationData> {
    const evaluation = this.evaluations.get(id);
    if (!evaluation) {
      throw new Error(`Evaluation not found: ${id}`);
    }

    const updated: EvaluationData = {
      ...evaluation,
      ...updates,
      updatedAt: new Date(),
    };
    this.evaluations.set(id, updated);
    return updated;
  }

  // ==========================================================================
  // Evaluation Results
  // ==========================================================================

  async saveEvaluationResult(params: CreateEvaluationResultParams): Promise<EvaluationResultData> {
    const result: EvaluationResultData = {
      id: crypto.randomUUID(),
      evaluationId: params.evaluationId,
      datasetItemId: params.datasetItemId,
      runId: params.runId,
      output: params.output,
      scores: params.scores,
      latencyMs: params.latencyMs,
      error: params.error,
      createdAt: new Date(),
    };
    this.results.set(result.id, result);
    return result;
  }

  async listEvaluationResults(params: {
    evaluationId: string;
    pagination: StoragePagination;
  }): Promise<{ results: EvaluationResultData[]; pagination: PaginationInfo }> {
    const { evaluationId, pagination } = params;
    const results = Array.from(this.results.values())
      .filter(r => r.evaluationId === evaluationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? results.length : start + perPage;

    return {
      results: results.slice(start, end),
      pagination: {
        total: results.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : results.length > end,
      },
    };
  }
}

/**
 * Helper to create empty collections for in-memory storage
 */
export function createDatasetInMemoryCollections(): DatasetInMemoryCollections {
  return {
    datasets: new Map(),
    items: new Map(),
    versions: new Map(),
    evaluations: new Map(),
    results: new Map(),
  };
}
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors
- Run `pnpm typecheck` in packages/core

---

#### STEP 2C: Wire Storage to MastraStorage (`base.ts`)

**File:** `packages/core/src/storage/base.ts`

**Task:** Add DatasetStorage to the main MastraStorage class.

**Dependencies:** STEP 2A and STEP 2B must be completed first.

**Instructions:**

1. First, read `packages/core/src/storage/base.ts` to understand the current structure.

2. Add import for DatasetStorage:

```typescript
import { DatasetStorage, DatasetInMemory, createDatasetInMemoryCollections } from './domains/datasets';
```

3. Add property to the MastraStorage class (or equivalent storage manager):

```typescript
private _datasets?: DatasetStorage;

get datasets(): DatasetStorage | undefined {
  return this._datasets;
}
```

4. Initialize in constructor or initialization method:

```typescript
// In the initialization logic where other storage domains are set up
this._datasets = new DatasetInMemory({
  collections: createDatasetInMemoryCollections(),
});
```

5. Update exports in `packages/core/src/storage/index.ts` to include:

```typescript
export * from './domains/datasets';
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors
- Run `pnpm typecheck` in packages/core

---

### STEP 3: Dataset & DatasetManager Classes

**Goal:** Create the public API classes for managing datasets.

**Parallel Execution:** STEP 3A and STEP 3B can be executed in parallel after STEP 2 is complete.

**Dependencies:** STEP 2A, STEP 2B, and STEP 2C must be completed first.

---

#### STEP 3A: DatasetManager Class (`manager.ts`)

**File:** `packages/evals/src/datasets/manager.ts`

**Task:** Create the DatasetManager class that provides the entry point for creating and retrieving datasets.

**Instructions:**

1. Create the directory structure:

   ```
   packages/evals/src/datasets/
   ```

2. Create `manager.ts` with the following content:

```typescript
import type { DatasetStorage } from '@mastra/core/storage';
import type { CreateDatasetParams, DatasetData, DatasetListParams, DatasetStatus } from '@mastra/core/evals';
import type { StoragePagination, PaginationInfo } from '@mastra/core/storage';
import { Dataset } from './dataset';

export interface DatasetManagerConfig {
  storage: DatasetStorage;
}

export class DatasetManager {
  private storage: DatasetStorage;

  constructor(config: DatasetManagerConfig) {
    this.storage = config.storage;
  }

  /**
   * Create a new dataset
   */
  async create(params: CreateDatasetParams): Promise<Dataset> {
    const data = await this.storage.createDataset(params);
    return new Dataset({ data, storage: this.storage });
  }

  /**
   * Get a dataset by ID
   */
  async get(id: string): Promise<Dataset | null> {
    const data = await this.storage.getDataset(id);
    if (!data) {
      return null;
    }
    return new Dataset({ data, storage: this.storage });
  }

  /**
   * Get a dataset by name
   */
  async getByName(name: string): Promise<Dataset | null> {
    const data = await this.storage.getDatasetByName(name);
    if (!data) {
      return null;
    }
    return new Dataset({ data, storage: this.storage });
  }

  /**
   * List all datasets with optional filtering and pagination
   */
  async list(params?: DatasetListParams): Promise<{
    datasets: Dataset[];
    pagination: PaginationInfo;
  }> {
    const pagination: StoragePagination = {
      page: params?.page ?? 0,
      perPage: params?.perPage ?? 10,
    };

    const result = await this.storage.listDatasets({
      pagination,
      status: params?.status,
    });

    return {
      datasets: result.datasets.map(data => new Dataset({ data, storage: this.storage })),
      pagination: result.pagination,
    };
  }

  /**
   * Get or create a dataset by name
   * Useful for idempotent dataset creation
   */
  async getOrCreate(params: CreateDatasetParams): Promise<{
    dataset: Dataset;
    created: boolean;
  }> {
    const existing = await this.getByName(params.name);
    if (existing) {
      return { dataset: existing, created: false };
    }
    const dataset = await this.create(params);
    return { dataset, created: true };
  }
}
```

**Verification:**

- Ensure file compiles without errors
- Run `pnpm build` in packages/evals to verify no TypeScript errors

---

#### STEP 3B: Dataset Class (`dataset.ts`)

**File:** `packages/evals/src/datasets/dataset.ts`

**Task:** Create the Dataset class that represents a dataset instance with all operations.

**Instructions:**

1. Create `dataset.ts` with the following content:

```typescript
import type { DatasetStorage } from '@mastra/core/storage';
import type {
  CreateDatasetItemParams,
  UpdateDatasetItemParams,
  DatasetData,
  DatasetItemData,
  DatasetVersionData,
  DatasetItemListParams,
  DatasetStatus,
  IterateItemsOptions,
  UpdateDatasetParams,
  FieldMapping,
} from '@mastra/core/evals';
import type { StoragePagination, PaginationInfo } from '@mastra/core/storage';

export interface DatasetConfig {
  data: DatasetData;
  storage: DatasetStorage;
}

export class Dataset {
  private _data: DatasetData;
  private storage: DatasetStorage;

  constructor(config: DatasetConfig) {
    this._data = config.data;
    this.storage = config.storage;
  }

  // ===========================================================================
  // Readonly Properties
  // ===========================================================================

  get id(): string {
    return this._data.id;
  }

  get name(): string {
    return this._data.name;
  }

  get description(): string | undefined {
    return this._data.description;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._data.metadata;
  }

  get schema(): DatasetData['schema'] | undefined {
    return this._data.schema;
  }

  get currentVersion(): number {
    return this._data.currentVersion;
  }

  get status(): DatasetStatus {
    return this._data.status;
  }

  get createdAt(): Date {
    return this._data.createdAt;
  }

  get updatedAt(): Date {
    return this._data.updatedAt;
  }

  /**
   * Get raw data object (useful for serialization)
   */
  toJSON(): DatasetData {
    return { ...this._data };
  }

  // ===========================================================================
  // Dataset Operations
  // ===========================================================================

  /**
   * Update dataset metadata (does NOT create a new version)
   */
  async update(updates: UpdateDatasetParams): Promise<Dataset> {
    this._data = await this.storage.updateDataset(this.id, updates);
    return this;
  }

  /**
   * Archive this dataset
   */
  async archive(): Promise<void> {
    await this.storage.archiveDataset(this.id);
    this._data = { ...this._data, status: 'ARCHIVED' };
  }

  /**
   * Refresh dataset data from storage
   */
  async refresh(): Promise<Dataset> {
    const data = await this.storage.getDataset(this.id);
    if (!data) {
      throw new Error(`Dataset ${this.id} not found`);
    }
    this._data = data;
    return this;
  }

  // ===========================================================================
  // Item Operations (each mutation creates a new version automatically)
  // ===========================================================================

  /**
   * Add items to the dataset
   * Creates a new version automatically
   */
  async addItems(items: CreateDatasetItemParams[]): Promise<{ items: DatasetItemData[]; version: DatasetVersionData }> {
    if (items.length === 0) {
      throw new Error('At least one item is required');
    }

    // Add items to storage
    const newItems = await this.storage.addItems(this.id, items);

    // Get all current active items for the new version
    const allItems = await this.getAllActiveItemIds();
    const newItemIds = newItems.map(item => item.id);
    const allItemIds = [...allItems, ...newItemIds];

    // Create new version
    const newVersion = this._data.currentVersion + 1;
    const version = await this.storage.createVersion({
      datasetId: this.id,
      version: newVersion,
      itemIds: allItemIds,
      description: `Added ${items.length} item(s)`,
    });

    // Update local state
    this._data = { ...this._data, currentVersion: newVersion, updatedAt: new Date() };

    return { items: newItems, version };
  }

  /**
   * Update a single item
   * Creates a new version automatically
   */
  async updateItem(
    itemId: string,
    updates: UpdateDatasetItemParams,
  ): Promise<{ item: DatasetItemData; version: DatasetVersionData }> {
    // Update the item
    const item = await this.storage.updateItem(itemId, updates);

    // Get all current active items for the new version
    const allItemIds = await this.getAllActiveItemIds();

    // Create new version (same items, but one was modified)
    const newVersion = this._data.currentVersion + 1;
    const version = await this.storage.createVersion({
      datasetId: this.id,
      version: newVersion,
      itemIds: allItemIds,
      description: `Updated item ${itemId}`,
    });

    // Update local state
    this._data = { ...this._data, currentVersion: newVersion, updatedAt: new Date() };

    return { item, version };
  }

  /**
   * Archive multiple items (soft delete)
   * Creates a new version automatically
   */
  async archiveItems(itemIds: string[]): Promise<{ version: DatasetVersionData }> {
    if (itemIds.length === 0) {
      throw new Error('At least one item ID is required');
    }

    // Archive the items
    await this.storage.archiveItems(itemIds);

    // Get all current active items for the new version (excluding archived)
    const allItemIds = await this.getAllActiveItemIds();
    const remainingItemIds = allItemIds.filter(id => !itemIds.includes(id));

    // Create new version
    const newVersion = this._data.currentVersion + 1;
    const version = await this.storage.createVersion({
      datasetId: this.id,
      version: newVersion,
      itemIds: remainingItemIds,
      description: `Archived ${itemIds.length} item(s)`,
    });

    // Update local state
    this._data = { ...this._data, currentVersion: newVersion, updatedAt: new Date() };

    return { version };
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get a single item by ID
   */
  async getItem(itemId: string): Promise<DatasetItemData | null> {
    return this.storage.getItem(itemId);
  }

  /**
   * List items with pagination
   */
  async listItems(params?: DatasetItemListParams): Promise<{
    items: DatasetItemData[];
    pagination: PaginationInfo;
  }> {
    const pagination: StoragePagination = {
      page: params?.page ?? 0,
      perPage: params?.perPage ?? 100,
    };

    return this.storage.listItems({
      datasetId: this.id,
      pagination,
      status: params?.status ?? 'ACTIVE',
    });
  }

  /**
   * Iterate over all items using async iterator
   * Memory-efficient for large datasets
   */
  async *iterateItems(options?: IterateItemsOptions): AsyncIterable<DatasetItemData> {
    const batchSize = options?.batchSize ?? 100;
    const version = options?.version;

    if (version !== undefined) {
      // Iterate items from a specific version
      yield* this.iterateVersionItems(version, { batchSize });
      return;
    }

    // Iterate current active items
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.storage.listItems({
        datasetId: this.id,
        pagination: { page, perPage: batchSize },
        status: 'ACTIVE',
      });

      for (const item of result.items) {
        yield item;
      }

      hasMore = result.pagination.hasMore;
      page++;
    }
  }

  /**
   * Get total count of active items
   */
  async getItemCount(): Promise<number> {
    const result = await this.storage.listItems({
      datasetId: this.id,
      pagination: { page: 0, perPage: 1 },
      status: 'ACTIVE',
    });
    return result.pagination.total;
  }

  // ===========================================================================
  // Version Operations
  // ===========================================================================

  /**
   * Get a specific version by version number
   */
  async getVersion(version: number): Promise<DatasetVersionData | null> {
    return this.storage.getVersionByNumber(this.id, version);
  }

  /**
   * List all versions of this dataset
   */
  async listVersions(): Promise<DatasetVersionData[]> {
    return this.storage.listVersions(this.id);
  }

  /**
   * Get items from a specific version with pagination
   */
  async getVersionItems(
    version: number,
    params?: { page?: number; perPage?: number },
  ): Promise<{ items: DatasetItemData[]; pagination: PaginationInfo }> {
    const versionData = await this.storage.getVersionByNumber(this.id, version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for dataset ${this.id}`);
    }

    const pagination: StoragePagination = {
      page: params?.page ?? 0,
      perPage: params?.perPage ?? 100,
    };

    return this.storage.getItemsByVersionId({
      versionId: versionData.id,
      pagination,
    });
  }

  /**
   * Iterate over items from a specific version
   * Memory-efficient for large datasets
   */
  async *iterateVersionItems(version: number, options?: { batchSize?: number }): AsyncIterable<DatasetItemData> {
    const batchSize = options?.batchSize ?? 100;

    const versionData = await this.storage.getVersionByNumber(this.id, version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for dataset ${this.id}`);
    }

    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.storage.getItemsByVersionId({
        versionId: versionData.id,
        pagination: { page, perPage: batchSize },
      });

      for (const item of result.items) {
        yield item;
      }

      hasMore = result.pagination.hasMore;
      page++;
    }
  }

  // ===========================================================================
  // Import/Export Operations
  // ===========================================================================

  /**
   * Import items from JSON array
   * Supports field mapping for flexible input formats
   */
  async importFromJSON(
    items: Record<string, unknown>[],
    options?: {
      fieldMapping?: FieldMapping;
    },
  ): Promise<{ items: DatasetItemData[]; version: DatasetVersionData }> {
    const mapping = options?.fieldMapping;

    const mappedItems: CreateDatasetItemParams[] = items.map(item => {
      const input = this.extractField(item, mapping?.input ?? 'input');
      const expectedOutput = this.extractField(item, mapping?.expectedOutput ?? 'expectedOutput');
      const metadata = this.extractField(item, mapping?.metadata ?? 'metadata');

      return {
        input: typeof input === 'object' ? (input as Record<string, unknown>) : { value: input },
        expectedOutput:
          expectedOutput !== undefined
            ? typeof expectedOutput === 'object'
              ? (expectedOutput as Record<string, unknown>)
              : { value: expectedOutput }
            : undefined,
        metadata:
          metadata !== undefined
            ? typeof metadata === 'object'
              ? (metadata as Record<string, unknown>)
              : { value: metadata }
            : undefined,
      };
    });

    return this.addItems(mappedItems);
  }

  /**
   * Export items to JSON array
   * Optionally export from a specific version
   */
  async exportToJSON(version?: number): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];

    if (version !== undefined) {
      for await (const item of this.iterateVersionItems(version)) {
        items.push({
          id: item.id,
          input: item.input,
          expectedOutput: item.expectedOutput,
          metadata: item.metadata,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
    } else {
      for await (const item of this.iterateItems()) {
        items.push({
          id: item.id,
          input: item.input,
          expectedOutput: item.expectedOutput,
          metadata: item.metadata,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
    }

    return items;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Get all active item IDs for version creation
   */
  private async getAllActiveItemIds(): Promise<string[]> {
    const itemIds: string[] = [];

    for await (const item of this.iterateItems()) {
      itemIds.push(item.id);
    }

    return itemIds;
  }

  /**
   * Extract a field value using field mapping
   */
  private extractField(obj: Record<string, unknown>, path: string | string[]): unknown {
    if (Array.isArray(path)) {
      // If multiple paths, return first non-undefined value
      for (const p of path) {
        const value = this.getNestedValue(obj, p);
        if (value !== undefined) {
          return value;
        }
      }
      return undefined;
    }

    return this.getNestedValue(obj, path);
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
```

**Verification:**

- Ensure file compiles without errors
- Run `pnpm build` in packages/evals to verify no TypeScript errors

---

#### STEP 3C: Exports (`index.ts`)

**File:** `packages/evals/src/datasets/index.ts`

**Task:** Create the index file that exports all dataset-related classes and types.

**Dependencies:** STEP 3A and STEP 3B must be completed first.

**Instructions:**

1. Create `index.ts` with the following content:

```typescript
export { Dataset } from './dataset';
export type { DatasetConfig } from './dataset';

export { DatasetManager } from './manager';
export type { DatasetManagerConfig } from './manager';

// Re-export types from core for convenience
export type {
  CreateDatasetParams,
  UpdateDatasetParams,
  CreateDatasetItemParams,
  UpdateDatasetItemParams,
  DatasetData,
  DatasetItemData,
  DatasetVersionData,
  DatasetListParams,
  DatasetItemListParams,
  DatasetStatus,
  IterateItemsOptions,
  FieldMapping,
} from '@mastra/core/evals';
```

2. Update `packages/evals/src/index.ts` to export the datasets module:

```typescript
// Add to existing exports
export * from './datasets';
```

**Verification:**

- Run `pnpm build` in packages/evals
- Run `pnpm typecheck` to ensure all exports resolve correctly

---

### STEP 4: Evaluation Runner

**Goal:** Implement evaluation execution against datasets.

**Parallel Execution:** STEP 4A and STEP 4B can be executed in parallel after STEP 3 is complete.

**Dependencies:** STEP 3A, STEP 3B, and STEP 3C must be completed first.

---

#### STEP 4A: Evaluation Types and Helpers

**File:** `packages/evals/src/evaluations/types.ts`

**Task:** Create additional types specific to the evaluation runner that aren't in core types.

**Instructions:**

1. Create the directory structure:

   ```
   packages/evals/src/evaluations/
   ```

2. Create `types.ts` with the following content:

```typescript
import type {
  EvaluationData,
  EvaluationResultData,
  EvaluationStatus,
  EvaluationEntityType,
  DatasetVersionData,
} from '@mastra/core/evals';
import type { MastraScorer } from '../scorer';

// =============================================================================
// Run Evaluation Parameters
// =============================================================================

export interface RunEvaluationParams {
  /** Unique name for this evaluation run */
  name: string;

  /** Dataset ID to run against */
  datasetId: string;

  /** Optional specific version to use (defaults to current version) */
  datasetVersion?: number;

  /** Entity type to evaluate */
  entityType: EvaluationEntityType;

  /** Entity ID (agent ID or workflow ID) */
  entityId: string;

  /** Scorers to run against each result */
  scorers: MastraScorer[];

  /** Optional metadata for the evaluation */
  metadata?: Record<string, unknown>;

  /** Concurrency limit for parallel execution */
  concurrency?: number;

  /** Callback when each item completes */
  onItemComplete?: (result: EvaluationItemResult) => void | Promise<void>;

  /** Callback for progress updates */
  onProgress?: (progress: EvaluationProgress) => void | Promise<void>;

  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
}

// =============================================================================
// Progress and Result Types
// =============================================================================

export interface EvaluationProgress {
  evaluationId: string;
  completed: number;
  total: number;
  failed: number;
  percentComplete: number;
}

export interface EvaluationItemResult {
  datasetItemId: string;
  output: unknown;
  scores: Record<string, { score: number; reason?: string }>;
  latencyMs: number;
  error?: string;
}

// =============================================================================
// Evaluation Instance (Hydrated with methods)
// =============================================================================

export interface Evaluation extends EvaluationData {
  /** Get all results for this evaluation */
  getResults(params?: { page?: number; perPage?: number }): Promise<{
    results: EvaluationResultData[];
    pagination: { total: number; page: number; perPage: number; hasMore: boolean };
  }>;

  /** Iterate over all results using async iterator */
  iterateResults(options?: { batchSize?: number }): AsyncIterable<EvaluationResultData>;

  /** Get the dataset version used in this evaluation */
  getDatasetVersion(): Promise<DatasetVersionData | null>;
}

// =============================================================================
// List Parameters
// =============================================================================

export interface ListEvaluationsParams {
  datasetId?: string;
  entityId?: string;
  entityType?: EvaluationEntityType;
  status?: EvaluationStatus;
  page?: number;
  perPage?: number;
}
```

**Verification:**

- Ensure file compiles without errors

---

#### STEP 4B: Evaluation Runner Class

**File:** `packages/evals/src/evaluations/runner.ts`

**Task:** Create the EvaluationRunner class that executes evaluations against datasets.

**Instructions:**

1. Create `runner.ts` with the following content:

```typescript
import type { DatasetStorage } from '@mastra/core/storage';
import type { Mastra } from '@mastra/core';
import type {
  EvaluationData,
  EvaluationResultData,
  DatasetItemData,
  EvaluationStatus,
  CreateEvaluationParams,
  CreateEvaluationResultParams,
  EvaluationSummary,
} from '@mastra/core/evals';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type {
  RunEvaluationParams,
  Evaluation,
  EvaluationProgress,
  EvaluationItemResult,
  ListEvaluationsParams,
} from './types';
import { Dataset, DatasetManager } from '../datasets';

export interface EvaluationRunnerConfig {
  storage: DatasetStorage;
  mastra: Mastra;
}

export class EvaluationRunner {
  private storage: DatasetStorage;
  private mastra: Mastra;
  private datasets: DatasetManager;

  constructor(config: EvaluationRunnerConfig) {
    this.storage = config.storage;
    this.mastra = config.mastra;
    this.datasets = new DatasetManager({ storage: config.storage });
  }

  /**
   * Run an evaluation against a dataset
   */
  async run(params: RunEvaluationParams): Promise<Evaluation> {
    const {
      name,
      datasetId,
      datasetVersion,
      entityType,
      entityId,
      scorers,
      metadata,
      concurrency = 1,
      onItemComplete,
      onProgress,
      signal,
    } = params;

    // 1. Resolve dataset and version
    const dataset = await this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const version = datasetVersion ?? dataset.currentVersion;
    const versionData = await dataset.getVersion(version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for dataset ${datasetId}`);
    }

    // 2. Create evaluation record (status: PENDING)
    const scorerIds = scorers.map(s => s.id);
    const evaluationParams: CreateEvaluationParams = {
      name,
      datasetId,
      datasetVersionId: versionData.id,
      scorerIds,
      entityType,
      entityId,
      metadata,
    };

    const evaluationData = await this.storage.createEvaluation(evaluationParams);

    // Update to RUNNING
    await this.storage.updateEvaluation(evaluationData.id, { status: 'RUNNING' });

    // 3. Gather all items from the version
    const items: DatasetItemData[] = [];
    for await (const item of dataset.iterateVersionItems(version)) {
      items.push(item);
    }

    const totalItems = items.length;
    let completedItems = 0;
    let failedItems = 0;
    const scoreAccumulators: Record<string, { sum: number; count: number }> = {};

    // Initialize score accumulators
    for (const scorerId of scorerIds) {
      scoreAccumulators[scorerId] = { sum: 0, count: 0 };
    }

    // 4. Process items with concurrency control
    const processItem = async (item: DatasetItemData): Promise<void> => {
      if (signal?.aborted) {
        throw new Error('Evaluation aborted');
      }

      const startTime = Date.now();
      let output: unknown;
      let error: string | undefined;
      const scores: Record<string, { scorerId: string; score: number; reason?: string }> = {};

      try {
        // Execute target (agent or workflow)
        output = await this.executeTarget(entityType, entityId, item.input);

        // Run scorers
        for (const scorer of scorers) {
          try {
            const scoreResult = await scorer.score({
              input: item.input,
              output,
              expectedOutput: item.expectedOutput,
            });

            scores[scorer.id] = {
              scorerId: scorer.id,
              score: scoreResult.score,
              reason: scoreResult.reason,
            };

            // Accumulate for summary
            scoreAccumulators[scorer.id].sum += scoreResult.score;
            scoreAccumulators[scorer.id].count += 1;
          } catch (scorerError) {
            scores[scorer.id] = {
              scorerId: scorer.id,
              score: 0,
              reason: `Scorer error: ${scorerError instanceof Error ? scorerError.message : String(scorerError)}`,
            };
          }
        }
      } catch (execError) {
        error = execError instanceof Error ? execError.message : String(execError);
        failedItems++;
      }

      const latencyMs = Date.now() - startTime;

      // Save evaluation result
      const resultParams: CreateEvaluationResultParams = {
        evaluationId: evaluationData.id,
        datasetItemId: item.id,
        runId: crypto.randomUUID(),
        output,
        scores,
        latencyMs,
        error,
      };

      await this.storage.createEvaluationResult(resultParams);
      completedItems++;

      // Call callbacks
      const itemResult: EvaluationItemResult = {
        datasetItemId: item.id,
        output,
        scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { score: v.score, reason: v.reason }])),
        latencyMs,
        error,
      };

      if (onItemComplete) {
        await onItemComplete(itemResult);
      }

      if (onProgress) {
        const progress: EvaluationProgress = {
          evaluationId: evaluationData.id,
          completed: completedItems,
          total: totalItems,
          failed: failedItems,
          percentComplete: Math.round((completedItems / totalItems) * 100),
        };
        await onProgress(progress);
      }
    };

    // Process with concurrency
    if (concurrency === 1) {
      // Sequential processing
      for (const item of items) {
        await processItem(item);
      }
    } else {
      // Parallel processing with concurrency limit
      const queue = [...items];
      const workers: Promise<void>[] = [];

      for (let i = 0; i < Math.min(concurrency, items.length); i++) {
        workers.push(
          (async () => {
            while (queue.length > 0) {
              const item = queue.shift();
              if (item) {
                await processItem(item);
              }
            }
          })(),
        );
      }

      await Promise.all(workers);
    }

    // 5. Calculate summary and update evaluation
    const summary: EvaluationSummary = {
      totalItems,
      completedItems,
      failedItems,
      scores: Object.fromEntries(
        Object.entries(scoreAccumulators).map(([scorerId, acc]) => [scorerId, acc.count > 0 ? acc.sum / acc.count : 0]),
      ),
    };

    const finalStatus: EvaluationStatus = failedItems === totalItems ? 'FAILED' : 'COMPLETED';

    await this.storage.updateEvaluation(evaluationData.id, {
      status: finalStatus,
      summary,
      completedAt: new Date(),
    });

    // 6. Return hydrated evaluation
    const finalData = await this.storage.getEvaluation(evaluationData.id);
    if (!finalData) {
      throw new Error('Evaluation not found after completion');
    }

    return this.hydrateEvaluation(finalData);
  }

  /**
   * Get an evaluation by ID
   */
  async get(id: string): Promise<Evaluation | null> {
    const data = await this.storage.getEvaluation(id);
    if (!data) {
      return null;
    }
    return this.hydrateEvaluation(data);
  }

  /**
   * List evaluations with optional filtering
   */
  async list(params?: ListEvaluationsParams): Promise<{
    evaluations: Evaluation[];
    pagination: PaginationInfo;
  }> {
    const pagination: StoragePagination = {
      page: params?.page ?? 0,
      perPage: params?.perPage ?? 10,
    };

    const result = await this.storage.listEvaluations({
      pagination,
      datasetId: params?.datasetId,
      entityId: params?.entityId,
      entityType: params?.entityType,
      status: params?.status,
    });

    return {
      evaluations: result.evaluations.map(data => this.hydrateEvaluation(data)),
      pagination: result.pagination,
    };
  }

  /**
   * Get results for an evaluation
   */
  async getResults(
    evaluationId: string,
    params?: { page?: number; perPage?: number },
  ): Promise<{ results: EvaluationResultData[]; pagination: PaginationInfo }> {
    const pagination: StoragePagination = {
      page: params?.page ?? 0,
      perPage: params?.perPage ?? 100,
    };

    return this.storage.listEvaluationResults({
      evaluationId,
      pagination,
    });
  }

  /**
   * Iterate over evaluation results
   */
  async *iterateResults(evaluationId: string, options?: { batchSize?: number }): AsyncIterable<EvaluationResultData> {
    const batchSize = options?.batchSize ?? 100;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.storage.listEvaluationResults({
        evaluationId,
        pagination: { page, perPage: batchSize },
      });

      for (const item of result.results) {
        yield item;
      }

      hasMore = result.pagination.hasMore;
      page++;
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Execute the target entity (agent or workflow)
   */
  private async executeTarget(
    entityType: 'AGENT' | 'WORKFLOW',
    entityId: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    if (entityType === 'AGENT') {
      const agent = this.mastra.getAgentById(entityId);
      if (!agent) {
        throw new Error(`Agent ${entityId} not found`);
      }

      // Assuming agent.generate() accepts input and returns output
      // Adjust based on actual Mastra agent API
      const result = await agent.generate(typeof input.prompt === 'string' ? input.prompt : JSON.stringify(input));

      return result.text ?? result;
    } else if (entityType === 'WORKFLOW') {
      const workflow = this.mastra.getWorkflowById(entityId);
      if (!workflow) {
        throw new Error(`Workflow ${entityId} not found`);
      }

      // Execute workflow with input
      const result = await workflow.execute(input);
      return result;
    }

    throw new Error(`Unknown entity type: ${entityType}`);
  }

  /**
   * Hydrate evaluation data with methods
   */
  private hydrateEvaluation(data: EvaluationData): Evaluation {
    const storage = this.storage;
    const runner = this;

    return {
      ...data,

      async getResults(params?: { page?: number; perPage?: number }) {
        return runner.getResults(data.id, params);
      },

      async *iterateResults(options?: { batchSize?: number }) {
        yield* runner.iterateResults(data.id, options);
      },

      async getDatasetVersion() {
        return storage.getVersion(data.datasetVersionId);
      },
    };
  }
}
```

**Verification:**

- Ensure file compiles without errors
- Run `pnpm build` in packages/evals

---

#### STEP 4C: Evaluations Exports (`index.ts`)

**File:** `packages/evals/src/evaluations/index.ts`

**Task:** Create the index file that exports all evaluation-related classes and types.

**Dependencies:** STEP 4A and STEP 4B must be completed first.

**Instructions:**

1. Create `index.ts` with the following content:

```typescript
export { EvaluationRunner } from './runner';
export type { EvaluationRunnerConfig } from './runner';

export type {
  RunEvaluationParams,
  Evaluation,
  EvaluationProgress,
  EvaluationItemResult,
  ListEvaluationsParams,
} from './types';

// Re-export types from core for convenience
export type {
  EvaluationData,
  EvaluationResultData,
  EvaluationStatus,
  EvaluationEntityType,
  EvaluationSummary,
  EvaluationResultScore,
  CreateEvaluationParams,
  CreateEvaluationResultParams,
  UpdateEvaluationParams,
} from '@mastra/core/evals';
```

2. Update `packages/evals/src/index.ts` to export the evaluations module:

```typescript
// Add to existing exports
export * from './evaluations';
```

**Verification:**

- Run `pnpm build` in packages/evals
- Run `pnpm typecheck` to ensure all exports resolve correctly

---

### STEP 5: Mastra Integration

**Goal:** Wire datasets and evaluations into the Mastra class.

**Parallel Execution:** STEP 5A and STEP 5B can be executed in parallel after STEP 4 is complete.

**Dependencies:** STEP 4A, STEP 4B, and STEP 4C must be completed first.

---

#### STEP 5A: Mastra Class Integration

**File:** `packages/core/src/mastra/index.ts`

**Task:** Add `datasets` and `evaluations` getters to the Mastra class.

**Instructions:**

1. First, read the existing `mastra/index.ts` file to understand the current structure.

2. Add imports at the top of the file:

```typescript
import { DatasetManager } from '@mastra/evals';
import { EvaluationRunner } from '@mastra/evals';
import type { DatasetStorage } from '../storage/domains/datasets';
```

3. Add private properties to the Mastra class:

```typescript
private _datasetManager?: DatasetManager;
private _evaluationRunner?: EvaluationRunner;
```

4. Add lazy-initialized getters:

```typescript
/**
 * Get the dataset manager for creating and managing datasets
 */
get datasets(): DatasetManager {
  if (!this._datasetManager) {
    const storage = this.getStorage();
    if (!storage?.datasets) {
      throw new Error('Storage with dataset support is required for datasets. Configure storage in Mastra options.');
    }
    this._datasetManager = new DatasetManager({
      storage: storage.datasets,
    });
  }
  return this._datasetManager;
}

/**
 * Get the evaluation runner for running evaluations against datasets
 */
get evaluations(): EvaluationRunner {
  if (!this._evaluationRunner) {
    const storage = this.getStorage();
    if (!storage?.datasets) {
      throw new Error('Storage with dataset support is required for evaluations. Configure storage in Mastra options.');
    }
    this._evaluationRunner = new EvaluationRunner({
      storage: storage.datasets,
      mastra: this,
    });
  }
  return this._evaluationRunner;
}
```

5. Add convenience method for running evaluations:

```typescript
/**
 * Run an evaluation against a dataset
 * Convenience method that delegates to evaluations.run()
 */
async runEvaluation(params: Parameters<EvaluationRunner['run']>[0]) {
  return this.evaluations.run(params);
}
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors
- Run `pnpm typecheck` in packages/core

---

#### STEP 5B: Storage Wiring

**File:** `packages/core/src/storage/base.ts` (or wherever MastraStorage is defined)

**Task:** Ensure DatasetStorage is properly initialized alongside other storage domains.

**Instructions:**

1. First, read the existing storage initialization code to understand the pattern.

2. Add import for DatasetStorage:

```typescript
import { DatasetStorage, DatasetInMemory, createDatasetInMemoryCollections } from './domains/datasets';
```

3. Add the datasets property to the storage interface/class:

```typescript
interface MastraStorageConfig {
  // ... existing config
  datasets?: DatasetStorage;
}

class MastraStorage {
  // ... existing properties

  private _datasets?: DatasetStorage;

  get datasets(): DatasetStorage | undefined {
    return this._datasets;
  }

  constructor(config: MastraStorageConfig) {
    // ... existing initialization

    // Initialize datasets storage (default to in-memory if not provided)
    if (config.datasets) {
      this._datasets = config.datasets;
    } else {
      // Default to in-memory storage
      this._datasets = new DatasetInMemory({
        collections: createDatasetInMemoryCollections(),
      });
    }
  }
}
```

4. Update the storage factory/initialization in the Mastra class if needed:

```typescript
// In Mastra class initialization
if (this.config.storage) {
  // Ensure datasets storage is available
  // The storage adapter should handle this internally
}
```

**Verification:**

- Run `pnpm build:core` to ensure no TypeScript errors
- Run `pnpm typecheck` in packages/core
- Verify that `mastra.datasets` and `mastra.evaluations` are accessible

---

### STEP 6: Server API Routes

**Goal:** Expose datasets and evaluations via REST API.

**Parallel Execution:** STEP 6A and STEP 6B can be executed in parallel after STEP 5 is complete.

**Dependencies:** STEP 5A and STEP 5B must be completed first.

---

#### STEP 6A: Zod Schemas

**File:** `packages/server/src/server/schemas/datasets.ts`

**Task:** Create Zod schemas for request/response validation.

**Instructions:**

1. Create `datasets.ts` with the following content:

```typescript
import z from 'zod';
import { paginationInfoSchema } from './common';

// =============================================================================
// Common Schemas
// =============================================================================

export const datasetStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export const datasetSchemaSchema = z.object({
  input: z.record(z.unknown()).optional(),
  expectedOutput: z.record(z.unknown()).optional(),
});

// =============================================================================
// Dataset Schemas
// =============================================================================

export const datasetDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  schema: datasetSchemaSchema.optional(),
  currentVersion: z.number(),
  status: datasetStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const datasetItemDataSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  input: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceTraceId: z.string().optional(),
  sourceSpanId: z.string().optional(),
  status: datasetStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const datasetVersionDataSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  version: z.number(),
  itemIds: z.array(z.string()),
  itemCount: z.number(),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
});

// =============================================================================
// Request Schemas
// =============================================================================

// Path params
export const datasetIdPathParams = z.object({
  id: z.string().describe('Dataset ID'),
});

export const datasetItemIdPathParams = z.object({
  id: z.string().describe('Dataset ID'),
  itemId: z.string().describe('Item ID'),
});

export const datasetVersionPathParams = z.object({
  id: z.string().describe('Dataset ID'),
  version: z.coerce.number().describe('Version number'),
});

// Query params
export const listDatasetsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  status: datasetStatusSchema.optional(),
});

export const listDatasetItemsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(100),
  status: datasetStatusSchema.optional(),
});

// Body schemas
export const createDatasetBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  schema: datasetSchemaSchema.optional(),
});

export const updateDatasetBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  schema: datasetSchemaSchema.optional(),
});

export const createDatasetItemBodySchema = z.object({
  input: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceTraceId: z.string().optional(),
  sourceSpanId: z.string().optional(),
});

export const addDatasetItemsBodySchema = z.object({
  items: z.array(createDatasetItemBodySchema).min(1),
});

export const updateDatasetItemBodySchema = z.object({
  input: z.record(z.unknown()).optional(),
  expectedOutput: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const archiveItemsBodySchema = z.object({
  itemIds: z.array(z.string()).min(1),
});

// =============================================================================
// Response Schemas
// =============================================================================

export const datasetResponseSchema = datasetDataSchema;

export const datasetsWithPaginationResponseSchema = z.object({
  datasets: z.array(datasetDataSchema),
  pagination: paginationInfoSchema,
});

export const datasetItemsWithPaginationResponseSchema = z.object({
  items: z.array(datasetItemDataSchema),
  pagination: paginationInfoSchema,
});

export const datasetVersionsResponseSchema = z.array(datasetVersionDataSchema);

export const addItemsResponseSchema = z.object({
  items: z.array(datasetItemDataSchema),
  version: datasetVersionDataSchema,
});

export const updateItemResponseSchema = z.object({
  item: datasetItemDataSchema,
  version: datasetVersionDataSchema,
});

export const archiveItemsResponseSchema = z.object({
  version: datasetVersionDataSchema,
});

// =============================================================================
// Evaluation Schemas
// =============================================================================

export const evaluationStatusSchema = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']);
export const evaluationEntityTypeSchema = z.enum(['AGENT', 'WORKFLOW']);

export const evaluationSummarySchema = z.object({
  totalItems: z.number(),
  completedItems: z.number(),
  failedItems: z.number(),
  scores: z.record(z.number()),
});

export const evaluationDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  datasetId: z.string(),
  datasetVersionId: z.string(),
  scorerIds: z.array(z.string()),
  entityType: evaluationEntityTypeSchema,
  entityId: z.string(),
  status: evaluationStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  summary: evaluationSummarySchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
});

export const evaluationResultScoreSchema = z.object({
  scorerId: z.string(),
  score: z.number(),
  reason: z.string().optional(),
});

export const evaluationResultDataSchema = z.object({
  id: z.string(),
  evaluationId: z.string(),
  datasetItemId: z.string(),
  runId: z.string(),
  output: z.unknown().optional(),
  scores: z.record(evaluationResultScoreSchema),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
  createdAt: z.coerce.date(),
});

// Evaluation request schemas
export const evaluationIdPathParams = z.object({
  id: z.string().describe('Evaluation ID'),
});

export const listEvaluationsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  datasetId: z.string().optional(),
  entityId: z.string().optional(),
  entityType: evaluationEntityTypeSchema.optional(),
  status: evaluationStatusSchema.optional(),
});

export const listEvaluationResultsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(100),
});

export const runEvaluationBodySchema = z.object({
  name: z.string().min(1),
  datasetId: z.string(),
  datasetVersion: z.number().optional(),
  entityType: evaluationEntityTypeSchema,
  entityId: z.string(),
  scorerIds: z.array(z.string()).min(1),
  metadata: z.record(z.unknown()).optional(),
  concurrency: z.number().optional().default(1),
});

// Evaluation response schemas
export const evaluationResponseSchema = evaluationDataSchema;

export const evaluationsWithPaginationResponseSchema = z.object({
  evaluations: z.array(evaluationDataSchema),
  pagination: paginationInfoSchema,
});

export const evaluationResultsWithPaginationResponseSchema = z.object({
  results: z.array(evaluationResultDataSchema),
  pagination: paginationInfoSchema,
});
```

**Verification:**

- Ensure file compiles without errors
- Run `pnpm build` in packages/server

---

#### STEP 6B: Route Handlers

**File:** `packages/server/src/server/handlers/datasets.ts`

**Task:** Create route handlers for datasets and evaluations.

**Instructions:**

1. Create `datasets.ts` with the following content:

```typescript
import type { DatasetData, DatasetItemData, DatasetVersionData } from '@mastra/core/evals';
import type { StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import {
  datasetIdPathParams,
  datasetItemIdPathParams,
  datasetVersionPathParams,
  listDatasetsQuerySchema,
  listDatasetItemsQuerySchema,
  createDatasetBodySchema,
  updateDatasetBodySchema,
  addDatasetItemsBodySchema,
  updateDatasetItemBodySchema,
  archiveItemsBodySchema,
  datasetResponseSchema,
  datasetsWithPaginationResponseSchema,
  datasetItemsWithPaginationResponseSchema,
  datasetVersionsResponseSchema,
  addItemsResponseSchema,
  updateItemResponseSchema,
  archiveItemsResponseSchema,
  evaluationIdPathParams,
  listEvaluationsQuerySchema,
  listEvaluationResultsQuerySchema,
  runEvaluationBodySchema,
  evaluationResponseSchema,
  evaluationsWithPaginationResponseSchema,
  evaluationResultsWithPaginationResponseSchema,
} from '../schemas/datasets';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// =============================================================================
// Dataset Routes
// =============================================================================

export const CREATE_DATASET_ROUTE = createRoute({
  method: 'POST',
  path: '/api/datasets',
  responseType: 'json',
  bodySchema: createDatasetBodySchema,
  responseSchema: datasetResponseSchema,
  summary: 'Create dataset',
  description: 'Creates a new dataset for evaluation',
  tags: ['Datasets'],
  handler: async ({ mastra, ...params }) => {
    try {
      const dataset = await mastra.datasets.create(params);
      return dataset.toJSON();
    } catch (error) {
      return handleError(error, 'Error creating dataset');
    }
  },
});

export const LIST_DATASETS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/datasets',
  responseType: 'json',
  queryParamSchema: listDatasetsQuerySchema,
  responseSchema: datasetsWithPaginationResponseSchema,
  summary: 'List datasets',
  description: 'Returns a paginated list of datasets',
  tags: ['Datasets'],
  handler: async ({ mastra, ...params }) => {
    try {
      const result = await mastra.datasets.list(params);
      return {
        datasets: result.datasets.map(d => d.toJSON()),
        pagination: result.pagination,
      };
    } catch (error) {
      return handleError(error, 'Error listing datasets');
    }
  },
});

export const GET_DATASET_ROUTE = createRoute({
  method: 'GET',
  path: '/api/datasets/:id',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  responseSchema: datasetResponseSchema.nullable(),
  summary: 'Get dataset',
  description: 'Returns a specific dataset by ID',
  tags: ['Datasets'],
  handler: async ({ mastra, id }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      return dataset?.toJSON() ?? null;
    } catch (error) {
      return handleError(error, 'Error getting dataset');
    }
  },
});

export const UPDATE_DATASET_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/datasets/:id',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: updateDatasetBodySchema,
  responseSchema: datasetResponseSchema,
  summary: 'Update dataset',
  description: 'Updates dataset metadata (does not create a new version)',
  tags: ['Datasets'],
  handler: async ({ mastra, id, ...params }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      await dataset.update(params);
      return dataset.toJSON();
    } catch (error) {
      return handleError(error, 'Error updating dataset');
    }
  },
});

export const ARCHIVE_DATASET_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/datasets/:id',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  responseSchema: datasetResponseSchema,
  summary: 'Archive dataset',
  description: 'Archives a dataset (soft delete)',
  tags: ['Datasets'],
  handler: async ({ mastra, id }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      await dataset.archive();
      return dataset.toJSON();
    } catch (error) {
      return handleError(error, 'Error archiving dataset');
    }
  },
});

// =============================================================================
// Dataset Item Routes
// =============================================================================

export const ADD_DATASET_ITEMS_ROUTE = createRoute({
  method: 'POST',
  path: '/api/datasets/:id/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: addDatasetItemsBodySchema,
  responseSchema: addItemsResponseSchema,
  summary: 'Add items to dataset',
  description: 'Adds items to a dataset and creates a new version',
  tags: ['Datasets'],
  handler: async ({ mastra, id, items }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      const result = await dataset.addItems(items);
      return result;
    } catch (error) {
      return handleError(error, 'Error adding items to dataset');
    }
  },
});

export const LIST_DATASET_ITEMS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/datasets/:id/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: listDatasetItemsQuerySchema,
  responseSchema: datasetItemsWithPaginationResponseSchema,
  summary: 'List dataset items',
  description: 'Returns a paginated list of items in a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, id, ...params }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      return await dataset.listItems(params);
    } catch (error) {
      return handleError(error, 'Error listing dataset items');
    }
  },
});

export const UPDATE_DATASET_ITEM_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/datasets/:id/items/:itemId',
  responseType: 'json',
  pathParamSchema: datasetItemIdPathParams,
  bodySchema: updateDatasetItemBodySchema,
  responseSchema: updateItemResponseSchema,
  summary: 'Update dataset item',
  description: 'Updates a dataset item and creates a new version',
  tags: ['Datasets'],
  handler: async ({ mastra, id, itemId, ...params }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      return await dataset.updateItem(itemId, params);
    } catch (error) {
      return handleError(error, 'Error updating dataset item');
    }
  },
});

export const ARCHIVE_DATASET_ITEMS_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/datasets/:id/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: archiveItemsBodySchema,
  responseSchema: archiveItemsResponseSchema,
  summary: 'Archive dataset items',
  description: 'Archives multiple items and creates a new version',
  tags: ['Datasets'],
  handler: async ({ mastra, id, itemIds }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      return await dataset.archiveItems(itemIds);
    } catch (error) {
      return handleError(error, 'Error archiving dataset items');
    }
  },
});

// =============================================================================
// Dataset Version Routes
// =============================================================================

export const LIST_DATASET_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/datasets/:id/versions',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  responseSchema: datasetVersionsResponseSchema,
  summary: 'List dataset versions',
  description: 'Returns all versions of a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, id }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      return await dataset.listVersions();
    } catch (error) {
      return handleError(error, 'Error listing dataset versions');
    }
  },
});

export const GET_VERSION_ITEMS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/datasets/:id/versions/:version/items',
  responseType: 'json',
  pathParamSchema: datasetVersionPathParams,
  queryParamSchema: listDatasetItemsQuerySchema,
  responseSchema: datasetItemsWithPaginationResponseSchema,
  summary: 'Get version items',
  description: 'Returns items from a specific dataset version',
  tags: ['Datasets'],
  handler: async ({ mastra, id, version, ...params }) => {
    try {
      const dataset = await mastra.datasets.get(id);
      if (!dataset) {
        throw new HTTPException(404, { message: 'Dataset not found' });
      }
      return await dataset.getVersionItems(version, params);
    } catch (error) {
      return handleError(error, 'Error getting version items');
    }
  },
});

// =============================================================================
// Evaluation Routes
// =============================================================================

export const RUN_EVALUATION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/evaluations',
  responseType: 'json',
  bodySchema: runEvaluationBodySchema,
  responseSchema: evaluationResponseSchema,
  summary: 'Run evaluation',
  description: 'Runs an evaluation against a dataset',
  tags: ['Evaluations'],
  handler: async ({ mastra, scorerIds, ...params }) => {
    try {
      // Resolve scorers from IDs
      const registeredScorers = await mastra.listScorers();
      const scorers = scorerIds.map((id: string) => {
        const scorer = registeredScorers?.[id];
        if (!scorer) {
          throw new HTTPException(400, { message: `Scorer ${id} not found` });
        }
        return scorer;
      });

      const evaluation = await mastra.evaluations.run({
        ...params,
        scorers,
      });

      // Return serializable data (without methods)
      const { getResults, iterateResults, getDatasetVersion, ...data } = evaluation;
      return data;
    } catch (error) {
      return handleError(error, 'Error running evaluation');
    }
  },
});

export const LIST_EVALUATIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/evaluations',
  responseType: 'json',
  queryParamSchema: listEvaluationsQuerySchema,
  responseSchema: evaluationsWithPaginationResponseSchema,
  summary: 'List evaluations',
  description: 'Returns a paginated list of evaluations',
  tags: ['Evaluations'],
  handler: async ({ mastra, ...params }) => {
    try {
      const result = await mastra.evaluations.list(params);
      return {
        evaluations: result.evaluations.map(exp => {
          const { getResults, iterateResults, getDatasetVersion, ...data } = exp;
          return data;
        }),
        pagination: result.pagination,
      };
    } catch (error) {
      return handleError(error, 'Error listing evaluations');
    }
  },
});

export const GET_EVALUATION_ROUTE = createRoute({
  method: 'GET',
  path: '/api/evaluations/:id',
  responseType: 'json',
  pathParamSchema: evaluationIdPathParams,
  responseSchema: evaluationResponseSchema.nullable(),
  summary: 'Get evaluation',
  description: 'Returns a specific evaluation by ID',
  tags: ['Evaluations'],
  handler: async ({ mastra, id }) => {
    try {
      const evaluation = await mastra.evaluations.get(id);
      if (!evaluation) {
        return null;
      }
      const { getResults, iterateResults, getDatasetVersion, ...data } = evaluation;
      return data;
    } catch (error) {
      return handleError(error, 'Error getting evaluation');
    }
  },
});

export const GET_EVALUATION_RESULTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/evaluations/:id/results',
  responseType: 'json',
  pathParamSchema: evaluationIdPathParams,
  queryParamSchema: listEvaluationResultsQuerySchema,
  responseSchema: evaluationResultsWithPaginationResponseSchema,
  summary: 'Get evaluation results',
  description: 'Returns results for a specific evaluation',
  tags: ['Evaluations'],
  handler: async ({ mastra, id, ...params }) => {
    try {
      return await mastra.evaluations.getResults(id, params);
    } catch (error) {
      return handleError(error, 'Error getting evaluation results');
    }
  },
});
```

2. Register routes in the server router (update the main router file to include these routes):

```typescript
// In the router registration file
import {
  CREATE_DATASET_ROUTE,
  LIST_DATASETS_ROUTE,
  GET_DATASET_ROUTE,
  UPDATE_DATASET_ROUTE,
  ARCHIVE_DATASET_ROUTE,
  ADD_DATASET_ITEMS_ROUTE,
  LIST_DATASET_ITEMS_ROUTE,
  UPDATE_DATASET_ITEM_ROUTE,
  ARCHIVE_DATASET_ITEMS_ROUTE,
  LIST_DATASET_VERSIONS_ROUTE,
  GET_VERSION_ITEMS_ROUTE,
  RUN_EVALUATION_ROUTE,
  LIST_EVALUATIONS_ROUTE,
  GET_EVALUATION_ROUTE,
  GET_EVALUATION_RESULTS_ROUTE,
} from './handlers/datasets';

// Add to route registration
const datasetRoutes = [
  CREATE_DATASET_ROUTE,
  LIST_DATASETS_ROUTE,
  GET_DATASET_ROUTE,
  UPDATE_DATASET_ROUTE,
  ARCHIVE_DATASET_ROUTE,
  ADD_DATASET_ITEMS_ROUTE,
  LIST_DATASET_ITEMS_ROUTE,
  UPDATE_DATASET_ITEM_ROUTE,
  ARCHIVE_DATASET_ITEMS_ROUTE,
  LIST_DATASET_VERSIONS_ROUTE,
  GET_VERSION_ITEMS_ROUTE,
];

const evaluationRoutes = [
  RUN_EVALUATION_ROUTE,
  LIST_EVALUATIONS_ROUTE,
  GET_EVALUATION_ROUTE,
  GET_EVALUATION_RESULTS_ROUTE,
];
```

**Verification:**

- Run `pnpm build` in packages/server
- Run `pnpm typecheck` in packages/server

---

### STEP 7: Tests

**Goal:** Comprehensive test coverage.

**Parallel Execution:** All four test files (STEP 7A-7D) can be executed in parallel after STEP 6 is complete.

**Dependencies:** STEP 6A and STEP 6B must be completed first.

---

#### STEP 7A: Storage Layer Tests (`inmemory.test.ts`)

**File:** `packages/core/src/storage/domains/datasets/inmemory.test.ts`

**Task:** Create comprehensive tests for the in-memory storage implementation.

**Instructions:**

1. Create `inmemory.test.ts` with the following content:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DatasetInMemory, createDatasetInMemoryCollections } from './inmemory';
import type {
  CreateDatasetParams,
  CreateDatasetItemParams,
  CreateEvaluationParams,
  CreateEvaluationResultParams,
} from '../../../evals/types';

describe('DatasetInMemory', () => {
  let storage: DatasetInMemory;

  beforeEach(() => {
    storage = new DatasetInMemory({
      collections: createDatasetInMemoryCollections(),
    });
  });

  // ===========================================================================
  // Dataset CRUD Tests
  // ===========================================================================

  describe('Dataset CRUD', () => {
    it('should create a dataset', async () => {
      const params: CreateDatasetParams = {
        name: 'Test Dataset',
        description: 'A test dataset',
        metadata: { key: 'value' },
      };

      const dataset = await storage.createDataset(params);

      expect(dataset.id).toBeDefined();
      expect(dataset.name).toBe('Test Dataset');
      expect(dataset.description).toBe('A test dataset');
      expect(dataset.metadata).toEqual({ key: 'value' });
      expect(dataset.currentVersion).toBe(0);
      expect(dataset.status).toBe('ACTIVE');
      expect(dataset.createdAt).toBeInstanceOf(Date);
      expect(dataset.updatedAt).toBeInstanceOf(Date);
    });

    it('should get a dataset by ID', async () => {
      const params: CreateDatasetParams = { name: 'Test Dataset' };
      const created = await storage.createDataset(params);

      const retrieved = await storage.getDataset(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent dataset', async () => {
      const retrieved = await storage.getDataset('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should get a dataset by name', async () => {
      const params: CreateDatasetParams = { name: 'Unique Name' };
      const created = await storage.createDataset(params);

      const retrieved = await storage.getDatasetByName('Unique Name');

      expect(retrieved).toEqual(created);
    });

    it('should list datasets with pagination', async () => {
      // Create multiple datasets
      for (let i = 0; i < 5; i++) {
        await storage.createDataset({ name: `Dataset ${i}` });
      }

      const result = await storage.listDatasets({
        pagination: { page: 0, perPage: 2 },
      });

      expect(result.datasets).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should filter datasets by status', async () => {
      const active = await storage.createDataset({ name: 'Active' });
      const toArchive = await storage.createDataset({ name: 'Archived' });
      await storage.archiveDataset(toArchive.id);

      const result = await storage.listDatasets({
        pagination: { page: 0, perPage: 10 },
        status: 'ACTIVE',
      });

      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].name).toBe('Active');
    });

    it('should update a dataset', async () => {
      const created = await storage.createDataset({ name: 'Original' });

      const updated = await storage.updateDataset(created.id, {
        name: 'Updated',
        description: 'New description',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('New description');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should archive a dataset', async () => {
      const created = await storage.createDataset({ name: 'To Archive' });

      await storage.archiveDataset(created.id);
      const archived = await storage.getDataset(created.id);

      expect(archived?.status).toBe('ARCHIVED');
    });
  });

  // ===========================================================================
  // Dataset Item Tests
  // ===========================================================================

  describe('Dataset Items', () => {
    let datasetId: string;

    beforeEach(async () => {
      const dataset = await storage.createDataset({ name: 'Items Test' });
      datasetId = dataset.id;
    });

    it('should add items to a dataset', async () => {
      const items: CreateDatasetItemParams[] = [
        { input: { prompt: 'Hello' }, expectedOutput: { response: 'Hi' } },
        { input: { prompt: 'Goodbye' } },
      ];

      const added = await storage.addItems(datasetId, items);

      expect(added).toHaveLength(2);
      expect(added[0].input).toEqual({ prompt: 'Hello' });
      expect(added[0].expectedOutput).toEqual({ response: 'Hi' });
      expect(added[1].input).toEqual({ prompt: 'Goodbye' });
      expect(added[1].expectedOutput).toBeUndefined();
    });

    it('should get an item by ID', async () => {
      const [added] = await storage.addItems(datasetId, [{ input: { prompt: 'Test' } }]);

      const retrieved = await storage.getItem(added.id);

      expect(retrieved).toEqual(added);
    });

    it('should list items with pagination', async () => {
      // Add 5 items
      const items = Array.from({ length: 5 }, (_, i) => ({
        input: { prompt: `Item ${i}` },
      }));
      await storage.addItems(datasetId, items);

      const result = await storage.listItems({
        datasetId,
        pagination: { page: 0, perPage: 2 },
      });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should update an item', async () => {
      const [added] = await storage.addItems(datasetId, [{ input: { prompt: 'Original' } }]);

      const updated = await storage.updateItem(added.id, {
        input: { prompt: 'Updated' },
        expectedOutput: { response: 'New' },
      });

      expect(updated.input).toEqual({ prompt: 'Updated' });
      expect(updated.expectedOutput).toEqual({ response: 'New' });
    });

    it('should archive items', async () => {
      const added = await storage.addItems(datasetId, [
        { input: { prompt: 'Item 1' } },
        { input: { prompt: 'Item 2' } },
      ]);

      await storage.archiveItems([added[0].id]);

      const result = await storage.listItems({
        datasetId,
        pagination: { page: 0, perPage: 10 },
        status: 'ACTIVE',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(added[1].id);
    });
  });

  // ===========================================================================
  // Version Tests
  // ===========================================================================

  describe('Versions', () => {
    let datasetId: string;

    beforeEach(async () => {
      const dataset = await storage.createDataset({ name: 'Version Test' });
      datasetId = dataset.id;
    });

    it('should create a version', async () => {
      const items = await storage.addItems(datasetId, [{ input: { prompt: 'Test' } }]);

      const version = await storage.createVersion({
        datasetId,
        version: 1,
        itemIds: items.map(i => i.id),
        description: 'First version',
      });

      expect(version.version).toBe(1);
      expect(version.itemIds).toEqual(items.map(i => i.id));
      expect(version.itemCount).toBe(1);
      expect(version.description).toBe('First version');
    });

    it('should get a version by ID', async () => {
      const version = await storage.createVersion({
        datasetId,
        version: 1,
        itemIds: [],
      });

      const retrieved = await storage.getVersion(version.id);

      expect(retrieved).toEqual(version);
    });

    it('should get a version by number', async () => {
      const version = await storage.createVersion({
        datasetId,
        version: 1,
        itemIds: [],
      });

      const retrieved = await storage.getVersionByNumber(datasetId, 1);

      expect(retrieved).toEqual(version);
    });

    it('should list all versions', async () => {
      await storage.createVersion({ datasetId, version: 1, itemIds: [] });
      await storage.createVersion({ datasetId, version: 2, itemIds: [] });

      const versions = await storage.listVersions(datasetId);

      expect(versions).toHaveLength(2);
    });

    it('should get items by version ID', async () => {
      const items = await storage.addItems(datasetId, [
        { input: { prompt: 'Test 1' } },
        { input: { prompt: 'Test 2' } },
      ]);

      const version = await storage.createVersion({
        datasetId,
        version: 1,
        itemIds: [items[0].id], // Only first item
      });

      const result = await storage.getItemsByVersionId({
        versionId: version.id,
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(items[0].id);
    });
  });

  // ===========================================================================
  // Evaluation Tests
  // ===========================================================================

  describe('Evaluations', () => {
    let datasetId: string;
    let versionId: string;

    beforeEach(async () => {
      const dataset = await storage.createDataset({ name: 'Evaluation Test' });
      datasetId = dataset.id;
      const version = await storage.createVersion({
        datasetId,
        version: 1,
        itemIds: [],
      });
      versionId = version.id;
    });

    it('should create an evaluation', async () => {
      const params: CreateEvaluationParams = {
        name: 'Test Evaluation',
        datasetId,
        datasetVersionId: versionId,
        scorerIds: ['scorer-1'],
        entityType: 'AGENT',
        entityId: 'agent-1',
        metadata: { key: 'value' },
      };

      const evaluation = await storage.createEvaluation(params);

      expect(evaluation.id).toBeDefined();
      expect(evaluation.name).toBe('Test Evaluation');
      expect(evaluation.status).toBe('PENDING');
      expect(evaluation.scorerIds).toEqual(['scorer-1']);
    });

    it('should update evaluation status', async () => {
      const evaluation = await storage.createEvaluation({
        name: 'Test',
        datasetId,
        datasetVersionId: versionId,
        scorerIds: [],
        entityType: 'AGENT',
        entityId: 'agent-1',
      });

      const updated = await storage.updateEvaluation(evaluation.id, {
        status: 'RUNNING',
      });

      expect(updated.status).toBe('RUNNING');
    });

    it('should list evaluations', async () => {
      await storage.createEvaluation({
        name: 'Exp 1',
        datasetId,
        datasetVersionId: versionId,
        scorerIds: [],
        entityType: 'AGENT',
        entityId: 'agent-1',
      });
      await storage.createEvaluation({
        name: 'Exp 2',
        datasetId,
        datasetVersionId: versionId,
        scorerIds: [],
        entityType: 'WORKFLOW',
        entityId: 'workflow-1',
      });

      const result = await storage.listEvaluations({
        pagination: { page: 0, perPage: 10 },
        datasetId,
      });

      expect(result.evaluations).toHaveLength(2);
    });

    it('should create and list evaluation results', async () => {
      const evaluation = await storage.createEvaluation({
        name: 'Test',
        datasetId,
        datasetVersionId: versionId,
        scorerIds: ['scorer-1'],
        entityType: 'AGENT',
        entityId: 'agent-1',
      });

      const resultParams: CreateEvaluationResultParams = {
        evaluationId: evaluation.id,
        datasetItemId: 'item-1',
        runId: 'run-1',
        output: { response: 'Hello' },
        scores: { 'scorer-1': { scorerId: 'scorer-1', score: 0.9 } },
        latencyMs: 100,
      };

      await storage.createEvaluationResult(resultParams);

      const results = await storage.listEvaluationResults({
        evaluationId: evaluation.id,
        pagination: { page: 0, perPage: 10 },
      });

      expect(results.results).toHaveLength(1);
      expect(results.results[0].scores['scorer-1'].score).toBe(0.9);
    });
  });
});
```

**Verification:**

- Run `pnpm test` in packages/core
- All tests should pass

---

#### STEP 7B: Dataset Class Tests (`dataset.test.ts`)

**File:** `packages/evals/src/datasets/dataset.test.ts`

**Task:** Create tests for the Dataset and DatasetManager classes.

**Instructions:**

1. Create `dataset.test.ts` with the following content:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Dataset, DatasetManager } from './index';
import { DatasetInMemory, createDatasetInMemoryCollections } from '@mastra/core/storage';

describe('DatasetManager', () => {
  let manager: DatasetManager;

  beforeEach(() => {
    const storage = new DatasetInMemory({
      collections: createDatasetInMemoryCollections(),
    });
    manager = new DatasetManager({ storage });
  });

  describe('create', () => {
    it('should create a dataset and return a Dataset instance', async () => {
      const dataset = await manager.create({
        name: 'Test Dataset',
        description: 'A test dataset',
      });

      expect(dataset).toBeInstanceOf(Dataset);
      expect(dataset.name).toBe('Test Dataset');
      expect(dataset.description).toBe('A test dataset');
      expect(dataset.currentVersion).toBe(0);
    });
  });

  describe('get', () => {
    it('should retrieve a dataset by ID', async () => {
      const created = await manager.create({ name: 'Test' });
      const retrieved = await manager.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await manager.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getByName', () => {
    it('should retrieve a dataset by name', async () => {
      await manager.create({ name: 'Unique Name' });
      const retrieved = await manager.getByName('Unique Name');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Unique Name');
    });
  });

  describe('getOrCreate', () => {
    it('should create a new dataset if it does not exist', async () => {
      const result = await manager.getOrCreate({ name: 'New Dataset' });

      expect(result.created).toBe(true);
      expect(result.dataset.name).toBe('New Dataset');
    });

    it('should return existing dataset if name matches', async () => {
      const first = await manager.create({ name: 'Existing' });
      const result = await manager.getOrCreate({ name: 'Existing' });

      expect(result.created).toBe(false);
      expect(result.dataset.id).toBe(first.id);
    });
  });

  describe('list', () => {
    it('should list all datasets with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.create({ name: `Dataset ${i}` });
      }

      const result = await manager.list({ page: 0, perPage: 2 });

      expect(result.datasets).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
    });
  });
});

describe('Dataset', () => {
  let manager: DatasetManager;
  let dataset: Dataset;

  beforeEach(async () => {
    const storage = new DatasetInMemory({
      collections: createDatasetInMemoryCollections(),
    });
    manager = new DatasetManager({ storage });
    dataset = await manager.create({ name: 'Test Dataset' });
  });

  describe('properties', () => {
    it('should expose readonly properties', () => {
      expect(dataset.id).toBeDefined();
      expect(dataset.name).toBe('Test Dataset');
      expect(dataset.currentVersion).toBe(0);
      expect(dataset.status).toBe('ACTIVE');
      expect(dataset.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('addItems', () => {
    it('should add items and create a new version', async () => {
      const result = await dataset.addItems([
        { input: { prompt: 'Hello' }, expectedOutput: { response: 'Hi' } },
        { input: { prompt: 'Goodbye' } },
      ]);

      expect(result.items).toHaveLength(2);
      expect(result.version.version).toBe(1);
      expect(dataset.currentVersion).toBe(1);
    });

    it('should throw if no items provided', async () => {
      await expect(dataset.addItems([])).rejects.toThrow('At least one item is required');
    });
  });

  describe('updateItem', () => {
    it('should update an item and create a new version', async () => {
      const { items } = await dataset.addItems([{ input: { prompt: 'Original' } }]);

      const result = await dataset.updateItem(items[0].id, {
        input: { prompt: 'Updated' },
      });

      expect(result.item.input).toEqual({ prompt: 'Updated' });
      expect(result.version.version).toBe(2);
      expect(dataset.currentVersion).toBe(2);
    });
  });

  describe('archiveItems', () => {
    it('should archive items and create a new version', async () => {
      const { items } = await dataset.addItems([{ input: { prompt: 'Item 1' } }, { input: { prompt: 'Item 2' } }]);

      const result = await dataset.archiveItems([items[0].id]);

      expect(result.version.version).toBe(2);
      expect(result.version.itemCount).toBe(1);
    });
  });

  describe('listItems', () => {
    it('should list active items with pagination', async () => {
      await dataset.addItems(Array.from({ length: 5 }, (_, i) => ({ input: { prompt: `Item ${i}` } })));

      const result = await dataset.listItems({ page: 0, perPage: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
    });
  });

  describe('iterateItems', () => {
    it('should iterate over all items', async () => {
      await dataset.addItems(Array.from({ length: 10 }, (_, i) => ({ input: { prompt: `Item ${i}` } })));

      const items: unknown[] = [];
      for await (const item of dataset.iterateItems({ batchSize: 3 })) {
        items.push(item);
      }

      expect(items).toHaveLength(10);
    });
  });

  describe('versions', () => {
    it('should list all versions', async () => {
      await dataset.addItems([{ input: { prompt: 'V1' } }]);
      await dataset.addItems([{ input: { prompt: 'V2' } }]);

      const versions = await dataset.listVersions();

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
    });

    it('should get a specific version', async () => {
      await dataset.addItems([{ input: { prompt: 'V1' } }]);

      const version = await dataset.getVersion(1);

      expect(version).not.toBeNull();
      expect(version?.version).toBe(1);
    });

    it('should get items from a specific version', async () => {
      await dataset.addItems([{ input: { prompt: 'V1 Item' } }]);
      await dataset.addItems([{ input: { prompt: 'V2 Item' } }]);

      const v1Items = await dataset.getVersionItems(1);

      expect(v1Items.items).toHaveLength(1);
      expect(v1Items.items[0].input).toEqual({ prompt: 'V1 Item' });
    });

    it('should iterate over version items', async () => {
      await dataset.addItems([{ input: { prompt: 'V1 Item' } }]);

      const items: unknown[] = [];
      for await (const item of dataset.iterateVersionItems(1)) {
        items.push(item);
      }

      expect(items).toHaveLength(1);
    });
  });

  describe('importFromJSON', () => {
    it('should import items from JSON array', async () => {
      const jsonData = [
        { input: { prompt: 'Test 1' }, expectedOutput: { response: 'Response 1' } },
        { input: { prompt: 'Test 2' } },
      ];

      const result = await dataset.importFromJSON(jsonData);

      expect(result.items).toHaveLength(2);
      expect(result.version.version).toBe(1);
    });

    it('should support field mapping', async () => {
      const jsonData = [
        { question: 'What is 2+2?', answer: '4' },
        { question: 'What is 3+3?', answer: '6' },
      ];

      const result = await dataset.importFromJSON(jsonData, {
        fieldMapping: {
          input: 'question',
          expectedOutput: 'answer',
        },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].input).toEqual({ value: 'What is 2+2?' });
      expect(result.items[0].expectedOutput).toEqual({ value: '4' });
    });
  });

  describe('exportToJSON', () => {
    it('should export all items to JSON', async () => {
      await dataset.addItems([{ input: { prompt: 'Test 1' } }, { input: { prompt: 'Test 2' } }]);

      const exported = await dataset.exportToJSON();

      expect(exported).toHaveLength(2);
      expect(exported[0].input).toEqual({ prompt: 'Test 1' });
    });

    it('should export items from a specific version', async () => {
      await dataset.addItems([{ input: { prompt: 'V1' } }]);
      await dataset.addItems([{ input: { prompt: 'V2' } }]);

      const exported = await dataset.exportToJSON(1);

      expect(exported).toHaveLength(1);
    });
  });

  describe('update and archive', () => {
    it('should update dataset metadata', async () => {
      await dataset.update({
        name: 'Updated Name',
        description: 'New description',
      });

      expect(dataset.name).toBe('Updated Name');
      expect(dataset.description).toBe('New description');
    });

    it('should archive the dataset', async () => {
      await dataset.archive();
      expect(dataset.status).toBe('ARCHIVED');
    });
  });
});
```

**Verification:**

- Run `pnpm test` in packages/evals
- All tests should pass

---

#### STEP 7C: Evaluation Runner Tests (`runner.test.ts`)

**File:** `packages/evals/src/evaluations/runner.test.ts`

**Task:** Create tests for the EvaluationRunner class.

**Instructions:**

1. Create `runner.test.ts` with the following content:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvaluationRunner } from './runner';
import { DatasetManager } from '../datasets';
import { DatasetInMemory, createDatasetInMemoryCollections } from '@mastra/core/storage';
import type { MastraScorer } from '../scorer';

// Mock Mastra class
const createMockMastra = () => ({
  getAgentById: vi.fn((id: string) => ({
    id,
    name: 'Test Agent',
    generate: vi.fn(async (prompt: string) => ({
      text: `Response to: ${prompt}`,
    })),
  })),
  getWorkflowById: vi.fn((id: string) => ({
    id,
    name: 'Test Workflow',
    execute: vi.fn(async (input: Record<string, unknown>) => ({
      result: `Processed: ${JSON.stringify(input)}`,
    })),
  })),
});

// Mock scorer
const createMockScorer = (id: string): MastraScorer => ({
  id,
  name: `Scorer ${id}`,
  description: 'A mock scorer',
  score: vi.fn(async ({ input, output, expectedOutput }) => ({
    score: expectedOutput ? 1.0 : 0.5,
    reason: 'Mock score',
  })),
});

describe('EvaluationRunner', () => {
  let storage: DatasetInMemory;
  let runner: EvaluationRunner;
  let datasets: DatasetManager;
  let mockMastra: ReturnType<typeof createMockMastra>;

  beforeEach(() => {
    storage = new DatasetInMemory({
      collections: createDatasetInMemoryCollections(),
    });
    mockMastra = createMockMastra();
    runner = new EvaluationRunner({
      storage,
      mastra: mockMastra as any,
    });
    datasets = new DatasetManager({ storage });
  });

  describe('run', () => {
    it('should run an evaluation against a dataset', async () => {
      // Create dataset with items
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems([
        { input: { prompt: 'Hello' }, expectedOutput: { response: 'Hi' } },
        { input: { prompt: 'Goodbye' }, expectedOutput: { response: 'Bye' } },
      ]);

      const scorer = createMockScorer('test-scorer');

      const evaluation = await runner.run({
        name: 'Test Evaluation',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      expect(evaluation.status).toBe('COMPLETED');
      expect(evaluation.summary?.totalItems).toBe(2);
      expect(evaluation.summary?.completedItems).toBe(2);
      expect(evaluation.summary?.failedItems).toBe(0);
    });

    it('should use a specific dataset version', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems([{ input: { prompt: 'V1' } }]);
      await dataset.addItems([{ input: { prompt: 'V2' } }]);

      const scorer = createMockScorer('scorer');

      const evaluation = await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        datasetVersion: 1, // Use first version with 1 item
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      expect(evaluation.summary?.totalItems).toBe(1);
    });

    it('should call onProgress callback', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems([{ input: { prompt: 'Item 1' } }, { input: { prompt: 'Item 2' } }]);

      const progressUpdates: unknown[] = [];
      const scorer = createMockScorer('scorer');

      await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
        onProgress: progress => {
          progressUpdates.push(progress);
        },
      });

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[1]).toMatchObject({
        completed: 2,
        total: 2,
        percentComplete: 100,
      });
    });

    it('should call onItemComplete callback', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems([{ input: { prompt: 'Test' } }]);

      const itemResults: unknown[] = [];
      const scorer = createMockScorer('scorer');

      await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
        onItemComplete: result => {
          itemResults.push(result);
        },
      });

      expect(itemResults).toHaveLength(1);
      expect(itemResults[0]).toHaveProperty('output');
      expect(itemResults[0]).toHaveProperty('scores');
      expect(itemResults[0]).toHaveProperty('latencyMs');
    });

    it('should handle execution errors gracefully', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems([{ input: { prompt: 'Error' } }]);

      // Mock agent to throw error
      mockMastra.getAgentById = vi.fn(() => ({
        generate: vi.fn(async () => {
          throw new Error('Agent error');
        }),
      }));

      const scorer = createMockScorer('scorer');

      const evaluation = await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      expect(evaluation.status).toBe('FAILED');
      expect(evaluation.summary?.failedItems).toBe(1);
    });

    it('should support concurrent execution', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems(Array.from({ length: 5 }, (_, i) => ({ input: { prompt: `Item ${i}` } })));

      const startTime = Date.now();
      const scorer = createMockScorer('scorer');

      await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
        concurrency: 3,
      });

      // With concurrency, should complete faster than sequential
      // This is a rough check, actual timing depends on mock implementation
      expect(Date.now() - startTime).toBeLessThan(5000);
    });

    it('should support abort signal', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems(Array.from({ length: 10 }, (_, i) => ({ input: { prompt: `Item ${i}` } })));

      const controller = new AbortController();
      const scorer = createMockScorer('scorer');

      // Abort after first item
      let itemCount = 0;
      mockMastra.getAgentById = vi.fn(() => ({
        generate: vi.fn(async () => {
          itemCount++;
          if (itemCount > 1) {
            controller.abort();
          }
          return { text: 'Response' };
        }),
      }));

      await expect(
        runner.run({
          name: 'Test',
          datasetId: dataset.id,
          entityType: 'AGENT',
          entityId: 'agent-1',
          scorers: [scorer],
          signal: controller.signal,
        }),
      ).rejects.toThrow('Evaluation aborted');
    });

    it('should work with workflows', async () => {
      const dataset = await datasets.create({ name: 'Test Dataset' });
      await dataset.addItems([{ input: { data: 'test' } }]);

      const scorer = createMockScorer('scorer');

      const evaluation = await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'WORKFLOW',
        entityId: 'workflow-1',
        scorers: [scorer],
      });

      expect(evaluation.status).toBe('COMPLETED');
      expect(mockMastra.getWorkflowById).toHaveBeenCalledWith('workflow-1');
    });
  });

  describe('get', () => {
    it('should retrieve an evaluation by ID', async () => {
      const dataset = await datasets.create({ name: 'Test' });
      await dataset.addItems([{ input: { prompt: 'Test' } }]);

      const scorer = createMockScorer('scorer');
      const created = await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      const retrieved = await runner.get(created.id);

      expect(retrieved?.id).toBe(created.id);
    });
  });

  describe('list', () => {
    it('should list evaluations', async () => {
      const dataset = await datasets.create({ name: 'Test' });
      await dataset.addItems([{ input: { prompt: 'Test' } }]);

      const scorer = createMockScorer('scorer');
      await runner.run({
        name: 'Exp 1',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });
      await runner.run({
        name: 'Exp 2',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      const result = await runner.list();

      expect(result.evaluations).toHaveLength(2);
    });
  });

  describe('getResults', () => {
    it('should get evaluation results', async () => {
      const dataset = await datasets.create({ name: 'Test' });
      await dataset.addItems([{ input: { prompt: 'Test 1' } }, { input: { prompt: 'Test 2' } }]);

      const scorer = createMockScorer('scorer');
      const evaluation = await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      const results = await runner.getResults(evaluation.id);

      expect(results.results).toHaveLength(2);
    });
  });

  describe('iterateResults', () => {
    it('should iterate over evaluation results', async () => {
      const dataset = await datasets.create({ name: 'Test' });
      await dataset.addItems(Array.from({ length: 5 }, (_, i) => ({ input: { prompt: `Item ${i}` } })));

      const scorer = createMockScorer('scorer');
      const evaluation = await runner.run({
        name: 'Test',
        datasetId: dataset.id,
        entityType: 'AGENT',
        entityId: 'agent-1',
        scorers: [scorer],
      });

      const results: unknown[] = [];
      for await (const result of runner.iterateResults(evaluation.id, { batchSize: 2 })) {
        results.push(result);
      }

      expect(results).toHaveLength(5);
    });
  });
});
```

**Verification:**

- Run `pnpm test` in packages/evals
- All tests should pass

---

#### STEP 7D: API Handler Tests (`datasets.test.ts`)

**File:** `packages/server/src/server/handlers/datasets.test.ts`

**Task:** Create tests for the REST API handlers.

**Instructions:**

1. Create `datasets.test.ts` with basic endpoint tests. Follow the existing test patterns in the server package.

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
// Import test utilities from existing server tests
// This is a skeleton - adapt to match existing patterns

describe('Dataset API Handlers', () => {
  describe('POST /api/datasets', () => {
    it('should create a new dataset', async () => {
      // Test implementation
    });
  });

  describe('GET /api/datasets', () => {
    it('should list datasets with pagination', async () => {
      // Test implementation
    });
  });

  describe('GET /api/datasets/:id', () => {
    it('should return a specific dataset', async () => {
      // Test implementation
    });

    it('should return null for non-existent dataset', async () => {
      // Test implementation
    });
  });

  describe('PATCH /api/datasets/:id', () => {
    it('should update dataset metadata', async () => {
      // Test implementation
    });
  });

  describe('DELETE /api/datasets/:id', () => {
    it('should archive a dataset', async () => {
      // Test implementation
    });
  });

  describe('POST /api/datasets/:id/items', () => {
    it('should add items and return new version', async () => {
      // Test implementation
    });
  });

  describe('GET /api/datasets/:id/items', () => {
    it('should list items with pagination', async () => {
      // Test implementation
    });
  });

  describe('GET /api/datasets/:id/versions', () => {
    it('should list all versions', async () => {
      // Test implementation
    });
  });
});

describe('Evaluation API Handlers', () => {
  describe('POST /api/evaluations', () => {
    it('should run an evaluation', async () => {
      // Test implementation
    });
  });

  describe('GET /api/evaluations', () => {
    it('should list evaluations', async () => {
      // Test implementation
    });
  });

  describe('GET /api/evaluations/:id', () => {
    it('should return evaluation details', async () => {
      // Test implementation
    });
  });

  describe('GET /api/evaluations/:id/results', () => {
    it('should return evaluation results', async () => {
      // Test implementation
    });
  });
});
```

Note: The actual implementation should follow existing test patterns in the server package. This skeleton provides the structure.

**Verification:**

- Run `pnpm test` in packages/server
- All tests should pass

---

### STEP 8: Documentation

**Goal:** User-facing documentation for the datasets feature.

**Parallel Execution:** STEP 8A and STEP 8B can be executed in parallel.

**Dependencies:** STEP 7 should be completed first (all tests passing).

---

#### STEP 8A: Package README Update

**File:** `packages/evals/README.md`

**Task:** Add a datasets section to the evals package README.

**Instructions:**

1. Add the following section to the README:

````markdown
## Datasets

Datasets provide a structured way to manage evaluation test cases with automatic versioning.

### Creating a Dataset

```typescript
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  /* config */
});

// Create a dataset
const dataset = await mastra.datasets.create({
  name: 'My Evaluation Dataset',
  description: 'Test cases for my agent',
});

// Add items to the dataset
const { items, version } = await dataset.addItems([
  {
    input: { prompt: 'What is 2+2?' },
    expectedOutput: { response: '4' },
  },
  {
    input: { prompt: 'What is the capital of France?' },
    expectedOutput: { response: 'Paris' },
  },
]);

console.log(`Created version ${version.version} with ${items.length} items`);
```
````

### Versioning

Every mutation (adding, updating, or archiving items) automatically creates a new version:

```typescript
// Version 1: Initial items
await dataset.addItems([{ input: { prompt: 'Test 1' } }]);

// Version 2: More items added
await dataset.addItems([{ input: { prompt: 'Test 2' } }]);

// Version 3: Item updated
await dataset.updateItem(itemId, { input: { prompt: 'Updated' } });

// List all versions
const versions = await dataset.listVersions();
console.log(versions);

// Get items from a specific version
const v1Items = await dataset.getVersionItems(1);
```

### Running Evaluations

Run evaluations against a dataset with one or more scorers:

```typescript
import { AnswerRelevancy, Faithfulness } from '@mastra/evals';

const evaluation = await mastra.evaluations.run({
  name: 'Agent Evaluation v1',
  datasetId: dataset.id,
  entityType: 'AGENT',
  entityId: 'my-agent',
  scorers: [new AnswerRelevancy(), new Faithfulness()],
  onProgress: progress => {
    console.log(`Progress: ${progress.percentComplete}%`);
  },
});

console.log('Results:', evaluation.summary);
```

### Iterating Large Datasets

For memory-efficient processing of large datasets:

```typescript
// Iterate with configurable batch size
for await (const item of dataset.iterateItems({ batchSize: 100 })) {
  console.log(item.input);
}

// Iterate a specific version
for await (const item of dataset.iterateVersionItems(1, { batchSize: 50 })) {
  console.log(item);
}
```

### Import/Export

Import from external sources with optional field mapping:

```typescript
// Direct import
await dataset.importFromJSON([{ input: { prompt: 'Test' }, expectedOutput: { response: 'Response' } }]);

// With field mapping for different formats
await dataset.importFromJSON([{ question: 'What is 2+2?', answer: '4' }], {
  fieldMapping: {
    input: 'question',
    expectedOutput: 'answer',
  },
});

// Export to JSON
const exportedData = await dataset.exportToJSON();
```

```

**Verification:**
- Review README for accuracy
- Ensure all code examples are correct

---

#### STEP 8B: Documentation Site Page

**File:** `docs/src/content/en/reference/evals/datasets.mdx`

**Task:** Create a documentation page for datasets.

**Instructions:**

1. Create the documentation file with comprehensive coverage of the datasets API, including:

- Overview and motivation
- Creating and managing datasets
- Working with items
- Version management
- Running evaluations
- API reference
- Examples

Note: Follow the existing documentation style and format in the docs directory.

**Verification:**
- Build docs locally to verify rendering
- Review for technical accuracy
- Check all links work

---

## Suggested Implementation Order

### Parallelization Strategy

```

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Foundation (parallel) │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ constants.ts (schemas) │ │ types.ts (interfaces) │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Storage + Class Stubs (parallel) │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ datasets/base.ts │ │ datasets/dataset.ts (stub) │ │
│ │ datasets/inmemory.ts │ │ datasets/manager.ts (stub) │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Implementation (parallel) │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Dataset class (full) │ │ evaluations/runner.ts │ │
│ │ DatasetManager (full) │ │ │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Integration + Server (parallel) │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Mastra integration │ │ schemas/datasets.ts │ │
│ │ (mastra.datasets) │ │ handlers/datasets.ts │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Tests (parallel) │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ inmemory │ │ dataset │ │ runner │ │ handlers │ │
│ │ .test.ts │ │ .test.ts │ │ .test.ts │ │ .test.ts │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Documentation │
└─────────────────────────────────────────────────────────────────────────┘

````

### Summary

| Step | Tasks (can run in parallel) | Depends On |
|------|----------------------------|------------|
| 1 | `constants.ts`, `types.ts` | - |
| 2 | Storage (`base.ts`, `inmemory.ts`), Class stubs | Step 1 |
| 3 | `Dataset` class, `DatasetManager`, `EvaluationRunner` | Step 2 |
| 4 | Mastra integration, Server routes | Step 3 |
| 5 | All test files | Step 4 |
| 6 | Documentation | Step 5 |

This reduces the implementation from 8 sequential phases to **6 steps with parallel work within each step**.

---

## Key Differentiators for Mastra

1. **Deep Trace Integration** - Leverage existing telemetry to create golden sets from production
2. **Scorer Pipeline Compatibility** - Datasets work seamlessly with the existing scorer architecture
3. **Workflow Step Evaluation** - Support for evaluating individual workflow steps, not just final output
4. **Type-Safe SDK** - Full TypeScript support with schema inference
5. **Pluggable Storage** - Same storage abstraction as other Mastra components

---

## Open Questions

_All questions have been resolved - see Notes & Decisions below._

---

## Notes & Decisions

### Decision 1: Automatic Versioning

**Decision:** Versioning is automatic on every mutation (add, update, archive items).

**Rationale:** This follows the Braintrust/Arize pattern where every modification creates a version. It ensures complete audit trail and allows evaluations to always pin to a reproducible state.

**Implementation:**
- Every `addItems`, `updateItem`, `archiveItems` call automatically increments `currentVersion`
- A new `DatasetVersion` record is created with the snapshot of current `itemIds`
- No manual `createVersion` API needed (removed from design)

### Decision 2: Large Dataset Handling via Async Iterators

**Decision:** Use async iterators for memory-efficient dataset iteration.

**Rationale:** Async iterators (`AsyncIterable`) are already used in the codebase (see `maskStreamTags` in `utils.ts`) and provide a clean pattern for streaming large datasets without loading everything into memory.

**Implementation:**

```typescript
// Storage interface additions
interface DatasetStorage {
  // Paginated fetch (existing pattern)
  listItems(datasetId: string, pagination: StoragePagination): Promise<{
    items: DatasetItem[];
    pagination: PaginationInfo;
  }>;

  // Async iterator for large datasets
  iterateItems(datasetId: string, options?: {
    batchSize?: number;  // Default: 100
    versionId?: string;  // Pin to specific version
  }): AsyncIterable<DatasetItem>;
}

// DatasetManager exposes both patterns
class DatasetManager {
  // For small datasets or UI pagination
  listItems(datasetId: string, params?: ListParams): Promise<DatasetItem[]>;

  // For large dataset processing
  async *iterateItems(datasetId: string, options?: IterateOptions): AsyncIterable<DatasetItem>;
}

// Usage in evaluations
async function runEvaluation(params: EvaluationParams) {
  const dataset = await getDataset(params.datasetId);

  // Stream items without loading all into memory
  for await (const item of dataset.iterateItems({ batchSize: 50 })) {
    await processItem(item);
  }
}
````

**Benefits:**

- Memory efficient for datasets with 10k+ items
- Works with existing pagination infrastructure under the hood
- Clean integration with `for await...of` loops
- Backpressure naturally handled

### Decision 3: No Dataset Forking

**Decision:** No support for forking/cloning datasets.

**Rationale:** Keeps the initial implementation simple. Users can export to JSON and import to a new dataset if needed.

### Decision 4: No Migration Path for runEvals Data

**Decision:** No automatic migration from inline `runEvals` data arrays.

**Rationale:** The existing `runEvals` API continues to work as-is. Datasets are a new, separate feature. Users can manually create datasets from their existing test data if desired.

### Decision 5: Single Target per Evaluation (Initially)

**Decision:** Each evaluation targets a single agent/workflow. Multi-agent A/B comparison deferred to future work.

**Rationale:** Keeps the initial implementation focused. Comparison can be done by running separate evaluations and using `compareEvaluations()` API.

**Future consideration:** Could add `targets: Agent[]` parameter later for simultaneous A/B testing

---

## References

- Langfuse Datasets: https://langfuse.com/docs/evaluation/experiments/datasets
- Braintrust Datasets: https://www.braintrust.dev/docs/core/datasets
- Arize Phoenix Datasets: https://arize.com/docs/phoenix/datasets-and-experiments/concepts-datasets
- Mastra Storage Constants: `packages/core/src/storage/constants.ts`
- Mastra Evals: `packages/evals/src/`
