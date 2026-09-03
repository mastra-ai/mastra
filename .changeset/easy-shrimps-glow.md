---
'@mastra/core': minor
---

Added optional `id`, `description`, and `metadata` to workflow control-flow entries: `.parallel()`, `.branch()`, `.dowhile()`, `.dountil()`, `.foreach()`, `.sleep()`, `.sleepUntil()`, and `.map()`. Executable steps already supported these fields; the entries between them now follow the same model, so visual editors and review tools can label a parallel block or a sleep and address it with a stable id instead of a generated one or a position in the graph.

```typescript
workflow
  .parallel([validateStep, enrichStep], {
    id: 'independent-enrichment',
    description: 'Run independent enrichment tasks concurrently',
    metadata: { title: 'Independent enrichment' },
  })
  .sleep(5000, { id: 'wait-before-retry', metadata: { title: 'Wait before retry' } });
```

The fields appear in `serializedStepGraph`, survive storage and rehydration of dynamic workflow definitions, and have no effect on execution. For `.map()`, `.sleep()`, and `.sleepUntil()`, a supplied `id` replaces the generated entry id.
