---
'@mastra/inngest': patch
---

Inngest workflows and durable agents now accept a `retries` option, so a run can survive a process restart or redeploy. Before this change, every Inngest function was created with `retries: 0` and there was no way to change it. If a request to the SDK failed (for example, the process restarted mid-run), the whole run failed straight away.

`retries` is passed to Inngest as its function-level retry count. When set, Inngest calls the function again after a failed request, skips the steps that already finished, and continues the run. Errors thrown by your own step code are still retried per step through `retryConfig` or `step.retries`, and are never retried again at the function level. The default is still `0`.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  retries: 3,
});

const durableAgent = createInngestAgent({ agent, inngest, retries: 3 });
```
