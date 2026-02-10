# Datasets API

Datasets are collections of test cases you run against agents, workflows, or scorers to evaluate their quality over time.

This document covers the programmatic TypeScript API. All methods require a `Mastra` instance with storage configured.

---

## Setup

```ts
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({ url: 'file:local.db' }),
  agents: { weatherAgent },
  scorers: { helpfulness, accuracy },
});
```

All dataset operations are accessed through `mastra.datasets`.

---

## Concepts

| Concept        | Description                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Dataset**    | A named collection of test items with optional schema validation (Zod or JSON Schema) on inputs and ground truths                     |
| **Item**       | A single test case within a dataset — has `input`, optional `groundTruth`, and optional `metadata`                                    |
| **Version**    | An immutable snapshot. Every mutation (add/update/delete items) creates a new dataset version. Items are also individually versioned. |
| **Experiment** | A run of a dataset against a target (agent, workflow, scorer, or inline function), with optional scoring                              |

**Generic type parameters** — `startExperiment<I, O, E>()` accepts optional generics for input (`I`), output (`O`), and groundTruth (`E`). Without them, types default to `unknown` and you must cast manually in the `task` callback.

---

## Dataset CRUD

### Create

```ts
import { z } from 'zod';

const ds = await mastra.datasets.create({
  name: 'customer-support-qa',
  description: 'QA pairs for support agent evaluation',
  inputSchema: z.object({
    question: z.string(),
    customerTier: z.enum(['free', 'pro', 'enterprise']),
  }),
  groundTruthSchema: z.object({
    answer: z.string(),
  }),
});

console.log(ds.id); // "d_abc123"
```

> **Note:** JSON Schema objects are also accepted for `inputSchema` and `groundTruthSchema`. For example, `{ type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }` works too.

`inputSchema` and `groundTruthSchema` are optional and accept either Zod schemas or JSON Schema objects. Zod schemas are automatically converted to JSON Schema internally. When provided, items are validated on add/update.

### Get

```ts
const ds = await mastra.datasets.get({ id: 'd_abc123' });
const details = await ds.getDetails();
console.log(details.name); // "customer-support-qa"
```

Throws if the dataset doesn't exist.

### List

```ts
const { datasets, pagination } = await mastra.datasets.list({
  page: 0,
  perPage: 20,
});

for (const d of datasets) {
  console.log(d.name, d.id);
}
```

### Delete

```ts
await mastra.datasets.delete({ id: 'd_abc123' });
```

Deletes the dataset, all its items, and all version history.

### Update

```ts
const updated = await ds.update({
  description: 'Updated QA dataset for v2 support agent',
  metadata: { team: 'support', sprint: 42 },
});
```

Zod schemas are also accepted for `inputSchema` and `groundTruthSchema` updates (same as `create()`).

If you change `inputSchema` or `groundTruthSchema` in a way that invalidates existing items, it throws `SchemaUpdateValidationError`.

---

## Items

### Add a single item

```ts
const item = await ds.addItem({
  input: { question: 'How do I reset my password?', customerTier: 'pro' },
  groundTruth: { answer: 'Go to Settings > Security > Reset Password' },
  metadata: { source: 'zendesk-ticket-4521' },
});

console.log(item.id); // "di_xyz789"
```

Throws `SchemaValidationError` if the item doesn't match the dataset's schemas.

### Bulk add

```ts
const items = await ds.addItems({
  items: [
    { input: { question: 'How do I upgrade?' }, groundTruth: { answer: 'Visit billing page' } },
    { input: { question: 'What are the limits?' }, groundTruth: { answer: '100 req/min on free' } },
    { input: { question: 'Do you support SSO?' }, groundTruth: { answer: 'Yes, enterprise plan' } },
  ],
});

console.log(items.length); // 3
```

### List items

```ts
// Paginated
const { items, pagination } = await ds.listItems({ page: 0, perPage: 50 });

// Historical version snapshot
const { items: historicalItems } = await ds.listItems({ version: versions[1].version });
```

### Get / update / delete

```ts
const item = await ds.getItem({ itemId: 'di_xyz789' }); // null if not found

const updated = await ds.updateItem({
  itemId: 'di_xyz789',
  groundTruth: { answer: 'Go to Settings > Account > Reset Password' },
});

await ds.deleteItem({ itemId: 'di_xyz789' });
await ds.deleteItems({ itemIds: ['di_abc456', 'di_def012'] });
```

---

## Versioning

Every item mutation (add, update, delete) creates a new dataset version. Items also track their own version history.

### Dataset versions

```ts
const { versions } = await ds.listVersions();
for (const v of versions) {
  console.log(v.version, v.id);
}

// Get all items at a historical version
const { items: historicalItems } = await ds.listItems({ version: versions[1].version });
```

### Item versions

```ts
// List all versions of an item
const { versions: itemVersions } = await ds.listItemVersions({ itemId: 'di_xyz789' });
for (const v of itemVersions) {
  console.log(v.versionNumber, v.snapshot, v.isDeleted);
}

// Get a specific version snapshot
const v2 = await ds.getItem({ itemId: 'di_xyz789', version: 2 });
console.log(v2?.snapshot);
```

---

## Experiments

An experiment runs every item in a dataset through a target and optionally scores the results.

### `startExperiment` — await completion

Runs the experiment and waits for all items to finish. Returns the full results.

**Registry target** (use an agent/workflow/scorer registered with Mastra):

```ts
const result = await ds.startExperiment({
  targetType: 'agent',
  targetId: 'weatherAgent',
  scorers: ['helpfulness', 'accuracy'],
  maxConcurrency: 5,
  itemTimeout: 30_000,
});

console.log(result.experimentId); // "exp_abc123"
console.log(result.status); // "completed"
console.log(result.succeededCount); // 48
console.log(result.failedCount); // 2

for (const item of result.results) {
  console.log(item.input, item.output, item.scores);
}
```

**Inline task** (pass a function instead of a registry target):

```ts
type QA = { question: string; customerTier: string };
type Answer = { answer: string };

const result = await ds.startExperiment<QA, Answer>({
  task: async ({ input, mastra, groundTruth }) => {
    // input is typed as QA, mastra gives access to agents/workflows
    const agent = mastra.getAgent('weatherAgent');
    const response = await agent.generate(input.question);
    return { answer: response.text }; // must match Answer
  },
  scorers: ['helpfulness', 'accuracy'],
  maxConcurrency: 5,
});
```

The inline `task` function receives a single object with `input`, `mastra`, `groundTruth`, `metadata`, and `signal`. The `mastra` instance lets you access agents, workflows, and other registered components. The task can return synchronously or asynchronously (`O | Promise<O>`).

**Generic type parameters** are optional. Without them, `input` defaults to `unknown`:

```ts
// Without generics — input is unknown, must narrow manually
const result = await ds.startExperiment({
  task: async ({ input, mastra }) => {
    const { question } = input as { question: string };
    return { answer: await mastra.getAgent('weatherAgent').generate(question) };
  },
  scorers: ['helpfulness'],
});
```

### `startExperimentAsync` — fire and forget

Starts the experiment in the background and returns immediately. Use this for long-running experiments where you want to poll for status.

```ts
const { experimentId, status } = await ds.startExperimentAsync({
  targetType: 'agent',
  targetId: 'weatherAgent',
  scorers: ['helpfulness'],
});

console.log(experimentId); // "exp_def456"
console.log(status); // "pending"

// Poll later
const run = await ds.getExperiment({ experimentId });
console.log(run?.status); // "running" | "completed" | "failed"
```

### Config options

| Option           | Type                                                                                                                                 | Default | Description                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------- |
| `targetType`     | `'agent' \| 'workflow' \| 'scorer'`                                                                                                  | —       | Type of registry target                                                            |
| `targetId`       | `string`                                                                                                                             | —       | ID of the target in Mastra's registry                                              |
| `task`           | `(args: { input: I, mastra: Mastra, groundTruth?: E, metadata?: Record<string, unknown>, signal?: AbortSignal }) => O \| Promise<O>` | —       | Inline task function, sync or async (alternative to `targetType`/`targetId`)       |
| `scorers`        | `(MastraScorer \| string)[]`                                                                                                         | `[]`    | Scorers to run on each result — MastraScorer instances or string IDs from registry |
| `maxConcurrency` | `number`                                                                                                                             | `5`     | Maximum concurrent item executions                                                 |
| `itemTimeout`    | `number` (ms)                                                                                                                        | —       | Per-item execution timeout                                                         |
| `signal`         | `AbortSignal`                                                                                                                        | —       | Abort signal for cancellation                                                      |
| `version`        | `Date`                                                                                                                               | latest  | Pin to a historical dataset version                                                |

You must provide either `targetType` + `targetId` **or** `task`. Not both.

The config is typed as `StartExperimentConfig<I, O, E>`. The dataset itself is always the data source — there is no `datasetId` or `data` option on this config.

### Read experiment results

```ts
// List all experiments for this dataset
const { runs, pagination } = await ds.listExperiments({ page: 0, perPage: 10 });
for (const run of runs) {
  console.log(run.id, run.status, run.targetType, run.targetId);
}

// Get a specific experiment
const run = await ds.getExperiment({ experimentId: 'exp_abc123' });
console.log(run?.status, run?.completedAt);

// Get per-item results
const { results } = await ds.listExperimentResults({ experimentId: 'exp_abc123', page: 0, perPage: 100 });
for (const r of results) {
  console.log(r.input, r.output, r.groundTruth, r.scores, r.traceId);
}

// Delete an experiment and its results
await ds.deleteExperiment({ experimentId: 'exp_abc123' });
```

### Compare experiments

Compare experiment runs side-by-side:

```ts
const comparison = await mastra.datasets.compareExperiments({
  experimentIds: ['exp_abc123', 'exp_def456'],
  baselineId: 'exp_abc123', // optional, defaults to first
});

comparison.baselineId; // 'exp_abc123'

for (const item of comparison.items) {
  console.log(item.itemId);
  console.log(item.input);
  console.log(item.groundTruth);
  console.log(item.results);
  // {
  //   exp_abc123: { output: 'Click forgot password', scores: { accuracy: 0.6 } },
  //   exp_def456: { output: 'Go to Settings > Security', scores: { accuracy: 0.9 } },
  // }
}
```

`compareExperiments` is on `mastra.datasets` (not on a specific dataset) because it compares runs that may belong to different datasets. The result shape uses `Record<string, ...>` keyed by experiment ID, making it N-way ready for future multi-experiment comparisons.

---

## Error handling

| Situation                  | Behavior                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| No storage configured      | `mastra.datasets` getter is safe. First method call throws `MastraError`                 |
| Dataset not found          | `mastra.datasets.get({ id })` throws                                                     |
| Item not found             | `ds.getItem({ itemId })` returns `null`                                                  |
| Experiment not found       | `ds.getExperiment({ experimentId })` returns `null`                                      |
| Input fails schema         | `ds.addItem()` / `ds.updateItem()` throws `SchemaValidationError`                        |
| Schema update breaks items | `ds.update()` throws `SchemaUpdateValidationError`                                       |
| Target not in registry     | `ds.startExperiment()` throws                                                            |
| Task throws for one item   | Error isolated — that item gets `output: null, error: message`. Other items continue.    |
| Scorer throws for one item | Error isolated — that scorer gets `score: null, error: message`. Other scorers continue. |

---

## API reference

### `mastra.datasets` — `DatasetsManager`

| Method                                                                                                                | Returns                    | Description                                                     |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| `create({ name, description?, inputSchema?: Zod \| JSONSchema7, groundTruthSchema?: Zod \| JSONSchema7, metadata? })` | `Dataset`                  | Create a new dataset                                            |
| `get({ id })`                                                                                                         | `Dataset`                  | Get a dataset by ID (throws if not found)                       |
| `list({ page?, perPage? })`                                                                                           | `{ datasets, pagination }` | List datasets with pagination                                   |
| `delete({ id })`                                                                                                      | `void`                     | Delete a dataset and all its data                               |
| `getExperiment({ experimentId })`                                                                                     | `Run \| null`              | Get an experiment by ID (cross-dataset)                         |
| `compareExperiments({ experimentIds, baselineId? })`                                                                  | `ComparisonResult`         | Compare experiments (returns `baselineId` + item-level results) |

### `Dataset`

**Metadata:**

| Method                                                                                                          | Returns                                                       |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `getDetails()`                                                                                                  | `DatasetRecord` — the dataset's name, schemas, metadata, etc. |
| `update({ description?, metadata?, inputSchema?: Zod \| JSONSchema7, groundTruthSchema?: Zod \| JSONSchema7 })` | `DatasetRecord` — the updated dataset                         |

**Items:**

| Method                                                    | Returns                                     |
| --------------------------------------------------------- | ------------------------------------------- |
| `addItem({ input, groundTruth?, metadata? })`             | `DatasetItem`                               |
| `addItems({ items })`                                     | `DatasetItem[]`                             |
| `getItem({ itemId, version? })`                           | `DatasetItem \| DatasetItemVersion \| null` |
| `listItems({ version?, page?, perPage? })`                | `{ items, pagination }`                     |
| `updateItem({ itemId, input?, groundTruth?, metadata? })` | `DatasetItem`                               |
| `deleteItem({ itemId })`                                  | `void`                                      |
| `deleteItems({ itemIds })`                                | `void`                                      |

**Versioning:**

| Method                                          | Returns                    |
| ----------------------------------------------- | -------------------------- |
| `listVersions({ page?, perPage? })`             | `{ versions, pagination }` |
| `listItemVersions({ itemId, page?, perPage? })` | `{ versions, pagination }` |

**Experiments:**

| Method                                                     | Returns                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `startExperiment<I, O, E>(config)`                         | `ExperimentSummary` — awaits completion                     |
| `startExperimentAsync<I, O, E>(config)`                    | `{ experimentId, status: 'pending' }` — returns immediately |
| `listExperiments({ page?, perPage? })`                     | `{ runs, pagination }`                                      |
| `getExperiment({ experimentId })`                          | `Run \| null`                                               |
| `listExperimentResults({ experimentId, page?, perPage? })` | `{ results, pagination }`                                   |
| `deleteExperiment({ experimentId })`                       | `void`                                                      |
