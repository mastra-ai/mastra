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

Runs started through `onMessage` report `channel.eventType` as `message`. Existing event types are unchanged. When a queued batch mixes mentioned and unmentioned senders, unmentioned senders go to `onMessage` only if it is set. Otherwise they still reach `onMention`, as before.

Fixes https://github.com/mastra-ai/mastra/issues/27060.
