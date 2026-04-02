---
'@mastra/core': minor
---

Added agent-level chat channels via Vercel Chat SDK adapters.

Agents can now communicate over messaging platforms like Slack, Discord, and Telegram using the `channels` configuration option. Each agent manages its own adapters and automatically handles event routing, thread mapping, tool generation, and streaming responses.

**Key features:**
- Configure channels directly on agents with `channels: { adapters: { slack: createSlackAdapter(), discord: createDiscordAdapter() } }`
- Automatic webhook route generation at `/api/agents/{agentId}/channels/{platform}/webhook`
- Tool approval buttons with `requireApproval: true` tools rendered as interactive cards
- Multi-user thread awareness with author prefixes for group conversations
- Thread subscriptions persisted via Mastra storage (survives restarts)

**New exports from `@mastra/core/channels`:**
- `AgentChannels` — internal class managing Chat SDK instance and event handlers
- `ChatChannelProcessor` — input processor injecting channel context into prompts
- `MastraStateAdapter` — StateAdapter backed by Mastra storage
