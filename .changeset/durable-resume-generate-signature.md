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

One deprecated call shape now throws instead of guessing: a string run ID followed by resume data that itself contains a string `runId`, with no third argument, for example `resumeGenerate('run-A', { runId: 'x', approved: true })`. To keep using the deprecated order, pass an explicit options argument: `resumeGenerate('run-A', { runId: 'x', approved: true }, {})`.
