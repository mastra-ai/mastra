---
'@mastra/core': patch
---

Fixed a race in Harness `sendMessage` where a phantom `agent_end: 'complete'` event could fire before any chunks arrived. Subscribers, such as apps running on Cloudflare Workers or Durable Objects, will no longer miss text deltas, messages, or tool events when an agent run completes.

The cause was `AgentThreadStreamRuntime.subscribeToThread`'s `activeRunId()` returning `null` during the gap between `sendSignal` reserving a runId and `registerRun` populating the stream record, which made `waitForCurrentThreadStreamIdle()` exit immediately and `sendMessage` emit a synthetic `agent_end`. The subscriber now treats both a reserved-but-not-yet-registered local run and an active remote run as live, matching `sendSignal`'s own behavior.
