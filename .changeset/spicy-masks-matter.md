---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Added `agent.listSuspendedRuns()` for discovering suspended runs from storage — runs waiting on a tool-call approval or on a tool that called `suspend()`. Unlike the in-memory `getActiveThreadRunId()`, discovery is backed by storage, so it works after a server restart and across multiple server instances:

```ts
const { runs, total } = await agent.listSuspendedRuns({ threadId, resourceId });
if (runs[0]) {
  // runs[0].toolCalls -> [{ toolCallId, toolName, args, requiresApproval }]
  await agent.approveToolCall({ runId: runs[0].runId, toolCallId: runs[0].toolCalls[0].toolCallId });
}
```

Supports `threadId`/`resourceId`/date filters and pagination, mirroring `listWorkflowRuns()`.

`sendToolApproval()` now falls back to this storage-backed discovery when no active run is found in memory for the thread, so approvals keep working after a restart. If several suspended runs match, it throws an error asking for a `toolCallId` to disambiguate.

**Why:** approval UIs previously had no public way to recover a suspended run after a page refresh or server restart, forcing apps to parse internal workflow snapshots.
