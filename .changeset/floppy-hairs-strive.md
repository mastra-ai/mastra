---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `requestContext` field to dataset item API endpoints and `requestContextSchema` to dataset CRUD endpoints. Added `requestContext` option to the experiment trigger endpoint, which gets forwarded to agent execution during experiments.

**Usage with `@mastra/client-js`:**

```ts
// Create a dataset with a request context schema
await client.createDataset({
  name: 'my-dataset',
  requestContextSchema: {
    type: 'object',
    properties: { region: { type: 'string' } },
  },
});

// Add an item with request context
await client.addDatasetItem({
  datasetId: 'my-dataset',
  input: { prompt: 'Hello' },
  requestContext: { region: 'us-east-1' },
});

// Trigger an experiment with request context forwarded to agent
await client.triggerDatasetExperiment({
  datasetId: 'my-dataset',
  agentId: 'my-agent',
  requestContext: { region: 'eu-west-1' },
});
```
