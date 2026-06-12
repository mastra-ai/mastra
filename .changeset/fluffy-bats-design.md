---
'@mastra/client-js': minor
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
---

Added `agent.listSuspendedRuns()` for discovering suspended agent runs, so human-in-the-loop approval UIs can be rebuilt after a page refresh or server restart:

```ts
const agent = client.getAgent('my-agent');
const { runs } = await agent.listSuspendedRuns({ threadId, resourceId });
if (runs[0]) {
  // runs[0].toolCalls -> [{ toolCallId, toolName, args, requiresApproval }]
  await agent.approveToolCall({ runId: runs[0].runId, toolCallId: runs[0].toolCalls[0].toolCallId });
}
```

Supports `threadId`/`resourceId`/date filters and pagination. Requires a Mastra server with the matching suspended-runs endpoint.
