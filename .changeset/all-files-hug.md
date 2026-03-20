---
'@mastra/mongodb': minor
---

Added datasets and experiments storage support to the MongoDB store.

**Datasets** — Full dataset management with versioned items. Create, update, and delete datasets and their items with automatic version tracking. Supports batch insert/delete operations, time-travel queries to retrieve items at any past version, and item history tracking.

**Experiments** — Run and track experiments against datasets. Full CRUD for experiments and per-item experiment results, with pagination, filtering, and cascade deletion.

Both domains are automatically available when using `MongoDBStore` — no additional configuration needed.

```ts
const store = new MongoDBStore({ uri: 'mongodb://localhost:27017', dbName: 'my-app' });

// Datasets
const dataset = await store.getStorage('datasets').createDataset({ name: 'my-dataset' });
await store.getStorage('datasets').addItem({ datasetId: dataset.id, input: { prompt: 'hello' } });

// Experiments
const experiment = await store.getStorage('experiments').createExperiment({ name: 'run-1', datasetId: dataset.id });
```
