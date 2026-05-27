---
'@mastra/core': minor
---

Customize (or disable) the channel system message via `channels.threadContext.systemMessage`. This is the system message `ChatChannelProcessor` adds on every step to tell the agent which channel/platform a request is coming from.

- `false` — skip `ChatChannelProcessor` entirely (no channel system message added).
- `string` — used verbatim as the system message content.
- `(ctx: ChannelContext) => string | undefined` — built dynamically per request. Returning `undefined` falls back to the built-in template; `''` skips the message for that request only.

```ts
new Agent({
  channels: {
    adapters: { slack: createSlackAdapter() },
    threadContext: {
      maxMessages: 20,
      systemMessage: ctx => ctx.isDM
        ? `You are in a DM on ${ctx.platform} with ${ctx.userName ?? 'a user'}.`
        : undefined, // fall back to default for non-DM
    },
  },
});
```
