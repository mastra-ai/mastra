---
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added `rootSpanName` to the generated `tracingOptions` request types so per-run root span names can be sent from the client.

```ts
const run = await client.getWorkflow("skillAnalyze").createRun();

await run.startAsync({
  inputData: { skillId: "typescript" },
  tracingOptions: { rootSpanName: "skill-analyze: typescript" },
});
```

Related: https://github.com/mastra-ai/mastra/issues/24518
