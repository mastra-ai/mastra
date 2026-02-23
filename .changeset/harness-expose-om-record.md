---
"@mastra/core": minor
---

Added `getObservationalMemoryRecord()` method to the `Harness` class. Fixes #13392.

This provides public access to the full `ObservationalMemoryRecord` for the current thread, including `activeObservations`, `generationCount`, and `observationTokenCount`. Previously, accessing raw observation text required bypassing the Harness abstraction by reaching into private storage internals.

```typescript
const record = await harness.getObservationalMemoryRecord();
if (record) {
  console.log(record.activeObservations);
}
```
