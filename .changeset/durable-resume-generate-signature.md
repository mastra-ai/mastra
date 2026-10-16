---
'@mastra/core': patch
'@mastra/inngest': patch
---

Durable agents (`createDurableAgent`, `createInngestAgent`) now accept `resumeGenerate(resumeData, { runId, toolCallId, ...options })`, the same signature as `Agent.resumeGenerate`. Before this change, code that held an `Agent` and resumed a durable agent this way failed, for example with `SQLite3 can only bind numbers, strings, bigints, buffers, and null` on LibSQL.

```ts
// Before (durable-only order, still supported but deprecated)
await durableAgent.resumeGenerate(runId, { approved: true });

// After (same as Agent)
await durableAgent.resumeGenerate({ approved: true }, { runId });
```
