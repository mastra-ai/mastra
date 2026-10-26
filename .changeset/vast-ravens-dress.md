---
'@mastra/core': minor
---

Added support for background tasks owned by code other than agents, such as MCP servers.

**Per-task retention.** Tasks accept optional `expiresAt` and `metadata` fields. When the `cleanup` option is set, cleanup deletes a finished task once its own `expiresAt` passes instead of using `completedTtlMs` or `failedTtlMs`. Pending, running, and suspended tasks are never deleted. `metadata` is stored with the task and not read by the manager.

```ts
await mastra.backgroundTaskManager.enqueue({
  agentId: 'mcp-server:ops',
  toolName: 'mcp-server:ops:deploy',
  toolCallId,
  runId,
  args,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  metadata: { ttlMs: 86_400_000 },
});
```

**Per-owner concurrency.** `perOwnerConcurrency` overrides `perAgentConcurrency` for specific owners, keyed by `agentId`. Each value must be a number of at least 1. These tasks still count toward `globalConcurrency`.

```ts
new Mastra({
  backgroundTasks: { enabled: true, globalConcurrency: 60, perOwnerConcurrency: { 'mcp-server:ops': 50 } },
});
```

**Queued resume.** `resume()` still throws when no concurrency slot is free. Pass `{ onNoSlot: 'queue' }` to keep the task suspended and resume it once a slot frees up. The queue is held in memory by the calling process, so a queued resume is lost if that process exits; the task stays suspended and can be resumed again. A queued resume is dropped if the task is cancelled or resumed elsewhere first.

```ts
await mastra.backgroundTaskManager.resume(taskId, resumeData, { onNoSlot: 'queue' });
```

Storage adapters need a matching release to store `expiresAt` and `metadata`. With an older adapter, cleanup detects that expiry is unsupported and keeps using only the global retention settings, as before.
