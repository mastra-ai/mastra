---
'@mastra/core': patch
---

Fixed `AgentChannels.consumeAgentStream` silently dropping `tripwire` chunks, which left channel users (Slack, Discord) with no response when a `strategy: "block"` processor fired. The chunk is now handled: when `retry` is `false`/unset the block reason is posted to the channel (prefixed with the `processorId` when present); when `retry` is `true` the chunk is skipped so the agent's retried output can flow through normally.
