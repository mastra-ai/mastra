---
'@mastra/core': patch
'@mastra/ai-sdk': patch
---

Fixed a delegated sub-agent's `suspend()`/resume answer getting silently overwritten by the delegation call's own later completion.

When a sub-agent's own tool suspends (e.g. asking the user a question), the delegation wrapper (`agent-<subAgentId>`) forwards that suspend as its own, reusing its own `toolCallId` for both the suspend chunk and the resume answer written back to it (e.g. via the AI SDK's `addToolOutput`). Once the sub-agent later finished for real, the delegation call's own genuine, unrelated completion (`{ text, subAgentToolResults, ... }`) landed on that same `toolCallId`, overwriting the answer a client had already written there — with no way for a UI to tell the two apart.

`suspend()` now emits a second, live `tool-call-suspended` chunk marked `resumed: true` once a suspended delegation call actually resumes, mirroring the existing storage-only `resumed` marker written to persisted messages. This chunk carries the same `toolCallId` so its `data-tool-call-suspended` UI part collapses onto the original suspension, giving clients a stable, collision-free signal that a question was answered — one that survives the delegation call's later completion overwriting the native tool part. Every internal chunk consumer that watches for `tool-call-suspended` (stream status tracking, sub-agent/network forwarding loops, the agent controller) now ignores this ack instead of treating it as a fresh suspension.
