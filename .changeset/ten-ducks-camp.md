---
'@mastra/core': minor
---

Added `allowFailure` option to `.parallel()` for graceful error handling in parallel workflow steps. When `allowFailure: true`, individual step failures no longer cause the entire parallel block to fail. Failed steps produce `null` in the downstream step's input, while error details remain available in `result.steps`.

**Usage:**

```typescript
workflow.parallel([researcherA, researcherB], { allowFailure: true }).then(writerStep).commit();
```
