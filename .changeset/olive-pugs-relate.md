---
'@mastra/memory': patch
---

Give the curation agent a step budget that matches its workload. Curation walks a worklist that can reach hundreds of records and its completion marker is fail-closed, so a curator that runs out of steps advances no cursor at all. It now defaults to 200 steps instead of 5, the configurable ceiling rises from 25 to 500, and the reflection worklist pages up to 1000 records instead of 500. An explicit `maxSteps` in subconscious config still wins over the per-agent default.

```ts
const memory = new Memory({
  processors: [
    new ObservationalMemory({
      subconscious: { model: openai('gpt-4o-mini') }, // curate now gets 200 steps
    }),
  ],
});
```
