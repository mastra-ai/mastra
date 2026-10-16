---
'@mastra/core': patch
'@mastra/inngest': patch
---

You can now resume durable agents (`createDurableAgent`, `createInngestAgent`) with the same `resumeGenerate(resumeData, { runId })` call you use with `Agent`.

```ts
// Before (durable-only order, still supported but deprecated)
await durableAgent.resumeGenerate(runId, { approved: true });

// After (same as Agent)
await durableAgent.resumeGenerate({ approved: true }, { runId });
```
