---
'@mastra/memory': patch
---

Subconscious curation now starts only after an observation is saved. If saving the observation fails or is skipped, the curator is never signaled and Knowledge is left untouched; observation still never waits on the curator.

Hook extractors receive a new `observationCommitted` promise that resolves `true` once the cycle's observations are saved and `false` otherwise. The cycle waits for your hook before it saves, so subscribe to the promise instead of awaiting it — awaiting it inside the hook blocks the observation cycle.

```ts
new Extractor({
  name: 'Audit',
  mode: 'hook',
  onExtracted: ({ rawObservations, observationCommitted }) => {
    void observationCommitted?.then(committed => {
      if (committed) return auditLog.write(rawObservations);
    });
  },
});
```
