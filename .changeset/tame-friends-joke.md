---
'@mastra/client-js': minor
---

Added client methods for previewing and creating replay datasets from stored conversations.

```ts
const source = { agentId: 'support', threadId: 'golden-thread' };
const { turnCount } = await client.previewReplayDataset(source);
const { itemIds } = await client.addDatasetItemsFromThread({ datasetId, ...source });
```

Dataset and experiment types now include working-memory seeds, lookup matching, and replay diagnostics.
