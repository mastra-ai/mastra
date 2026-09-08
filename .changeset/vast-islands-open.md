---
'@mastra/core': patch
---

Fixed durable agent runs being restarted by the generic boot-time workflow recovery. On server start, `Mastra.restartAllActiveWorkflowRuns()` restarted every active workflow run, including the internal workflows that back durable agents — even when `recovery.durableAgents` was `'off'` (the default), and racing the dedicated recovery path when set to `'auto'`. Durable agent runs are now only recovered through `recovery.durableAgents: 'auto'`. The internal durable agent workflows also no longer appear in `listWorkflows()` or the Studio workflow list; they remain accessible by id. Fixes [#22598](https://github.com/mastra-ai/mastra/issues/22598).

**New workflow option `autoRestartActiveRuns`**

Any workflow can now opt out of the automatic boot-time restart, for example when its side effects must not be re-driven by a blanket restart:

```typescript
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: {
    // Exclude this workflow from Mastra.restartAllActiveWorkflowRuns()
    autoRestartActiveRuns: false,
  },
});
```
