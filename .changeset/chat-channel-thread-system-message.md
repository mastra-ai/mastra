---
'@mastra/core': minor
---

Customize (or disable) the channel system message via `channels.threadContext.systemMessage`. This is the system message `ChatChannelProcessor` adds on every step to tell the agent which channel/platform a request is coming from.

- `false` — skip `ChatChannelProcessor` entirely (no channel system message added).
- `string` — used verbatim as the system message content.
- `(ctx: ChannelContext) => string | undefined` — built dynamically per request. Return `undefined` (or `''`) to skip the message for that request.

Keep the resolved content stable per thread (branch only on thread-stable inputs like `platform`, `isDM`) so it stays prompt-cacheable. For mid-conversation state, send a signal into the thread instead of varying this message on every turn.

```ts
new Agent({
  channels: {
    adapters: { slack: createSlackAdapter() },
    threadContext: {
      maxMessages: 20,
      systemMessage: ctx => ctx.isDM
        ? `You are in a DM on ${ctx.platform} with ${ctx.userName ?? 'a user'}.`
        : `You are in a public ${ctx.platform} channel.`,
    },
  },
});
```

`defaultChannelSystemMessage` is also exported from `@mastra/core/channels` if you want to compose the built-in template with your own overrides.
