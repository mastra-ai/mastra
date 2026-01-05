---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/inngest': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'create-mastra': patch
---

Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly

```diff
+ const run = await workflow.createRun({ runId: '123' });
- const stream = await run.streamVNext({ inputData: { ... } });
+ const stream = await run.stream({ inputData: { ... } });
```