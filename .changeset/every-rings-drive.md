---
'@mastra/code-sdk': patch
---

The default memory from `createMastraCode()` now has a `settled()` method. Await it before closing storage so background memory work, such as buffered observations and their indexing, finishes first.

```ts
const { memory, storageMaintenance } = await createMastraCode();
if (memory && 'settled' in memory) await memory.settled();
await storageMaintenance?.closeStorage?.();
```
