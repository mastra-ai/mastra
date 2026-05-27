---
'@mastra/core': minor
---

Added `channels.threadContext.addSystemMessage` to opt out of the built-in channel system message. By default, `AgentChannels` injects a short system message telling the agent which channel/platform a request came from (DM vs public, bot identity, etc.). Set `addSystemMessage: false` to skip it:

```ts
new Agent({
  channels: {
    adapters: { slack: createSlackAdapter() },
    threadContext: {
      addSystemMessage: false,
    },
  },
});
```

For finer-grained control, register your own input processor with `id: 'chat-channel-context'` — it shadows the built-in one, so you don't need to disable it separately.
