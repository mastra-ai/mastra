---
'@mastra/core': patch
---

Fixed channel thread subscriptions bleeding across agents that share one Mastra storage instance. One bot subscribing to a conversation made every bot reply, because all agents resolved the same external conversation (same Telegram chat id, same Slack or Discord channel) to a single Mastra thread and shared its `channel_subscribed` flag. Each agent now gets its own thread per external conversation through a new `channel_ownerId` metadata key, and thread lookups are scoped to the owning agent. Existing threads without the key are adopted in place by the first agent that touches them, so single-agent deployments keep their history and subscription state with no migration step. Threads claimed by another agent are never reused.
