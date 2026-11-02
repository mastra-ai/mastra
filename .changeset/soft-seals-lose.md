---
'@mastra/core': minor
---

Added whole-conversation replay using the existing thread import and experiment APIs. Candidate history and memory carry forward on an isolated thread, with per-turn evidence and aggregate scores.

```ts
const items = await datasetItemsFromThread({ memory, threadId, mode: 'conversation' });
await dataset.addItems({ items });
await dataset.startExperiment({ targetType: 'agent', targetId: 'support' });
```
