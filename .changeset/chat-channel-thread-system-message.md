---
'@mastra/core': minor
---

Added `channels.addProcessor` to opt out of the built-in `ChatChannelProcessor`. By default, `AgentChannels` adds a `ChatChannelProcessor` that injects a short system message telling the agent which channel/platform a request came from. Pass `addProcessor: false` to skip it entirely:

```ts
new Agent({
  channels: {
    adapters: { slack: createSlackAdapter() },
    addProcessor: false,
  },
});
```

For finer-grained control, register your own input processor with `id: 'chat-channel-context'` — it shadows the built-in one, so you don't need to disable it separately.
