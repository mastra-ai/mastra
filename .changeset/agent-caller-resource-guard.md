---
'@mastra/core': patch
'@mastra/server': patch
---

Agent sends and tool approvals now reject a caller whose request context carries a `MASTRA_RESOURCE_ID_KEY` that does not own the target thread or run, before anything is queued, stored or delivered. This covers `sendSignal`, `sendMessage`, `queueMessage`, `approveToolCall` and `declineToolCall` (and their `…Generate` variants), on `Agent` and `DurableAgent`. A call that names only a `runId` is checked against the resource that owns that run. Only the caller's top-level `requestContext` is checked; `ifIdle.streamOptions.requestContext` is not.

`SendAgentSignalOptions` gains an optional top-level `requestContext`. It applies whether the thread is idle or active, and wins over `ifIdle.streamOptions.requestContext`.

```ts
await agent.sendSignal(signal, { resourceId, threadId, requestContext });
```

The `/agents/:agentId/signals`, `/send-message` and `/queue-message` routes now pass the caller's request context, so a `runId` that belongs to another resource's run is rejected with a 403.

`resumeStream`, `resumeGenerate` and `sendStreamResume` do not enforce this check yet; that is a follow-up.
