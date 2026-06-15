---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'mastra': patch
---

Added storage-backed discovery of suspended agent runs, so human-in-the-loop approval UIs can recover a pending run after a page refresh or server restart.

`agent.listSuspendedRuns()` lists runs waiting on a tool-call approval or on a tool that called `suspend()`. Unlike the in-memory `getActiveThreadRunId()`, it reads from storage, so it works after a restart and across multiple server instances:

```ts
const { runs, total } = await agent.listSuspendedRuns({ threadId, resourceId });
if (runs[0]) {
  // runs[0].toolCalls -> [{ toolCallId, toolName, args, requiresApproval }]
  await agent.approveToolCall({ runId: runs[0].runId, toolCallId: runs[0].toolCalls[0].toolCallId });
}
```

Supports `threadId`/`resourceId`/date filters and pagination, mirroring `listWorkflowRuns()`. The same surface is exposed over HTTP as `GET /agents/:agentId/suspended-runs` and on the client SDK as `agent.listSuspendedRuns()`; server-enforced request-context values take precedence over client query parameters, so clients cannot list runs outside their scope.

`sendToolApproval()` now falls back to this storage-backed discovery when no active run is found in memory for the thread, so approvals keep working after a restart. If several suspended runs match, it throws an error asking for a `toolCallId` to disambiguate.

**Why:** approval UIs previously had no public way to recover a suspended run after a refresh or restart, forcing apps to parse internal workflow snapshots.
