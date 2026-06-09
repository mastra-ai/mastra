---
'@internal/playground': patch
---

Wire request context into dataset experiments in Studio.

You can now define a dataset's `requestContextSchema` when creating or editing a dataset. You can set per-item `requestContext` values on dataset items. You can also provide run-level request context when triggering an experiment.

The run dialog renders a schema-driven form when the dataset declares a `requestContextSchema`, and falls back to a raw JSON editor otherwise. This lets values like `clinicId` flow from Studio through to agent/workflow experiment runs.

```ts
// 1. Dataset declares the request context it expects
const dataset = await client.createDataset({
  name: 'patients',
  requestContextSchema: { type: 'object', properties: { clinicId: { type: 'string' } } },
});

// 2. A dataset item provides per-item request context
await client.addDatasetItem({
  datasetId: dataset.id,
  input: { patientId: 'p-123' },
  requestContext: { clinicId: 'clinic-a' },
});

// 3. Triggering an experiment can supply run-level request context
await client.triggerDatasetExperiment({
  datasetId: dataset.id,
  targetType: 'agent',
  targetId: 'clinicDirectAgent',
  requestContext: { clinicId: 'clinic-a' },
});
```
