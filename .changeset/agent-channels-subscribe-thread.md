---
'@mastra/core': minor
---

Added `AgentChannels.subscribeThread()` so bots can subscribe to chat threads they started themselves (for example, a scheduled digest post). The method creates the Mastra thread mapping and subscribes it, so replies without an @mention reach the agent.

```ts
const sent = await channel.post('Daily digest ready');
await agent.channels.subscribeThread({ thread: sent.thread, resourceId: 'digest-bot' });
```

Subscribing to a thread with no Mastra mapping now logs a warning instead of silently doing nothing.
