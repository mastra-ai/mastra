---
'@mastra/core': minor
---

Scoped channel threads per agent so multiple agents sharing one storage instance no longer bleed conversation history and subscription state into each other's threads. Each agent now maps a platform thread (Slack, Discord, Telegram) to its own Mastra thread via a `channel_agentId` metadata key; threads created before this change are claimed by the first agent that touches them, keeping existing history. Fixes thread subscription state bleeding across agents.

Added a `respondToBots` option to the channels config (default `false`). Agents now ignore messages authored by other bots in the default handlers, preventing bot-to-bot reply loops when multiple bots share a channel or thread. This is a behavior change: previously another bot's message in a subscribed thread would wake the agent. Opt back in with `respondToBots: true`:

```typescript
export const agent = new Agent({
  id: 'agent',
  channels: {
    adapters: {
      slack: createSlackAdapter(),
    },
    respondToBots: true,
  },
})
```
