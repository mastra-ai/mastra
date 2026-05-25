---
'@mastra/core': patch
---

Fixed a race in Harness `sendMessage` where a phantom `agent_end: 'complete'` event could fire before any chunks arrived. Subscribers that closed on the first `agent_end` (for example UIs running on Cloudflare Workers / Durable Objects) lost every text-delta, message, and tool event the agent produced.

The cause was `AgentThreadStreamRuntime.subscribeToThread`'s `activeRunId()` returning `null` during the gap between `sendSignal` reserving a runId and `registerRun` populating the stream record, which made `waitForCurrentThreadStreamIdle()` exit immediately and `sendMessage` emit a synthetic `agent_end`. The subscriber now treats both a reserved-but-not-yet-registered local run and an active remote run as live, matching `sendSignal`'s own behavior.
