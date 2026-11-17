---
'@mastra/client-js': minor
---

Added typed conversation replay imports and turn results through the existing client methods.

```ts
await client.previewReplayDataset({ agentId, threadId, mode: 'conversation' });
```
