---
'@mastra/core': patch
---

Channels now serialize messages per thread to keep conversations in order:

- Messages arriving while the agent is busy are delivered into the running agent loop instead of starting a new, conflicting stream on the same channel thread.
- Each Mastra thread shares one subscription, reducing per-message resource overhead in channel-heavy deployments.
- Channel/author facts (platform, message id, author name) are surfaced on the stored message under `providerMetadata.mastra.channels.<platform>` so UI and queries can read them without unpacking signal envelopes.
- New `AgentChannels.close()` tears down all live thread subscriptions for that agent — useful for tests and graceful shutdown of long-lived processes.
