---
'@mastra/core': minor
---

Added golden thread replay datasets. Each completed user turn captures recorded history, tool outputs, expected trajectory, and working memory. Replay runs use isolated memory and can finish and score after an unmatched tool call without executing it live.

```ts
import { datasetItemsFromThread } from '@mastra/core/datasets';

const items = await datasetItemsFromThread({ memory, threadId: 'golden-thread', historyLimit: 10 });
await dataset.addItems({ items });
await dataset.startExperiment({ targetType: 'agent', targetId: 'support' });
```

Use `toolMockMatchMode: 'lookup'` with `unmockedToolPolicy: 'deny'` on other experiment items to opt into the same recoverable mock lookup. `memorySeed.workingMemory` restores recorded state before execution. Reports include misses and call order.
