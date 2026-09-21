---
'@mastra/core': minor
'@mastra/observability': patch
'@mastra/server': patch
---

Added `rootSpanName` to `tracingOptions` so each agent or workflow run can set its own root span name. Runs of the same workflow no longer all show up as `workflow run: 'my-workflow'` in trace lists.

```ts
await run.start({
  inputData: { skillId: 'typescript' },
  tracingOptions: { rootSpanName: 'skill-analyze: typescript' },
});
```

The name applies to the root span only. Child spans keep their default names, and entity filters still match on the workflow or agent id. Related: https://github.com/mastra-ai/mastra/issues/24518
