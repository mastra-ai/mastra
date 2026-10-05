---
'@mastra/memory': patch
---

Subconscious curation now starts only after an observation is saved. If saving the observation fails or is skipped, the curator is never signaled and Knowledge is left untouched; observation still never waits on the curator. Hook extractors receive a new `observationCommitted` promise that resolves `true` once the cycle's observations are committed and `false` otherwise.

```ts
new Extractor({
  name: 'Audit',
  mode: 'hook',
  onExtracted: async ({ rawObservations, observationCommitted }) => {
    if (await observationCommitted) await auditLog.write(rawObservations);
  },
});
```
