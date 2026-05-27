---
'@mastra/core': minor
---

Customize (or disable) the channel system message via `channels.threadContext.systemMessage`. This is the system message `ChatChannelProcessor` adds on every step to tell the agent which channel/platform a request is coming from.

- `false` — skip `ChatChannelProcessor` entirely (no channel system message added).
- `string` — used verbatim as the system message content.
- `(ctx: ChannelContext) => string | undefined` — built dynamically per request. Return `undefined` (or `''`) to skip the message for that request. To compose with the default for some cases, import `defaultChannelSystemMessage` from `@mastra/core/channels`.

Keep the resolved content stable per thread (branch only on thread-stable inputs like `platform`, `isDM`, `userName`) so it stays prompt-cacheable. For mid-conversation state, send a signal into the thread instead of varying this message on every turn.

```ts
import { defaultChannelSystemMessage } from '@mastra/core/channels';

new Agent({
  channels: {
    adapters: { slack: createSlackAdapter() },
    threadContext: {
      maxMessages: 20,
      systemMessage: ctx => ctx.isDM
        ? `You are in a DM on ${ctx.platform} with ${ctx.userName ?? 'a user'}.`
        : defaultChannelSystemMessage(ctx),
    },
  },
});
```
