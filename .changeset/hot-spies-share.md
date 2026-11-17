---
'@mastra/server': minor
---

Added optional conversation mode to the existing replay preview and import requests, plus nested turn results.

```ts
await client.addDatasetItemsFromThread({ datasetId, agentId, threadId, mode: 'conversation' });
```
