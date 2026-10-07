---
'@mastra/core': patch
---

Fixed agent sends and tool approvals accepting input from a caller that does not own the target thread or run. When the request context carries a `MASTRA_RESOURCE_ID_KEY` for a different resource, `sendSignal`, `sendMessage`, `queueMessage`, `approveToolCall`, `declineToolCall`, `approveToolCallGenerate` and `declineToolCallGenerate` on `Agent` and `DurableAgent` now reject the call before anything is queued, stored or delivered. A call that names only a `runId` is checked against the resource that owns that run.

`SendAgentSignalOptions` gains an optional top-level `requestContext`. It applies whether the thread is idle or active. When both it and `ifIdle.streamOptions.requestContext` are set, the top-level one is used and is the only one checked.

```ts
await agent.sendSignal(signal, { resourceId, threadId, requestContext });
```

`resumeStream`, `resumeGenerate` and `sendStreamResume` do not enforce this check yet.
