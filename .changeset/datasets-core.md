---
'@mastra/core': minor
---

Added Datasets and Experiments to core. Datasets let you store and version collections of test inputs with JSON Schema validation. Experiments let you run AI outputs against dataset items with configurable scorers to track quality over time.

**New exports from `@mastra/core`:**
- `DatasetsManager` — orchestrates dataset CRUD, item versioning (SCD-2), and experiment execution
- `Dataset` — single-dataset handle for adding items and running experiments

**New storage domains:**
- `DatasetsStorage` — abstract base class for dataset persistence (datasets, items, versions)
- `ExperimentsStorage` — abstract base class for experiment lifecycle and result tracking

**Example:**

```ts
import { Mastra, DatasetsManager } from '@mastra/core';

const mastra = new Mastra({ /* ... */ });
const datasets = new DatasetsManager({ mastra });

const dataset = await datasets.create({ name: 'my-eval-set' });
await dataset.addItems([
  { input: { query: 'What is 2+2?' }, groundTruth: { answer: '4' } },
]);

const result = await dataset.runExperiment({
  targetType: 'agent',
  targetId: 'my-agent',
  scorerIds: ['accuracy'],
});
```
