---
'@mastra/slack': patch
'@mastra/core': patch
---

SlackProvider now merges with existing channel adapters instead of replacing them. Previously, calling `mastra.channels.slack.connect(agentId)` (or auto-init on first webhook) would clobber any adapters the agent author had already configured (e.g. Discord). Now Slack is added alongside existing adapters, preserving the original `ChannelConfig` via the new `AgentChannels.channelConfig` field.
