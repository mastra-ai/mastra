---
'@mastra/core': minor
---

Added an opt-in `onMessage` channel handler for messages that do not mention the bot. Call `defaultHandler` to run the agent, post its reply, and subscribe the thread. Unmentioned messages stay ignored when the handler is omitted or `false`.

```ts
import type { ChannelHandlers } from '@mastra/core/channels';

const handlers: ChannelHandlers = {
  onMessage: async (thread, message, defaultHandler) => {
    if (thread.channelId !== 'slack:C_SUPPORT') return;
    await defaultHandler(thread, message);
  },
};
```

Channel event context now reports `message` for these messages and DMs, `mention` for new mentions, and `subscribed` for subscribed-thread messages.

Fixes https://github.com/mastra-ai/mastra/issues/27060.
