---
'@mastra/core': minor
---

Added per-platform `dedupeTtlMs` and `threadContext.maxMessages` options to channel adapters, so one agent that serves several platforms can tune each one separately.

A single `AgentChannels` serves every platform, and its `chatOptions` and `threadContext` apply to all of them, so changing the deduplication window or the first-mention history budget for one platform changed it for all. Wrap an adapter in a config object and set the value on that platform:

```ts
const agent = new Agent({
  // ...
  channels: {
    adapters: {
      slack: {
        adapter: createSlackAdapter(),
        dedupeTtlMs: 60_000,
        threadContext: { maxMessages: 25 },
      },
      discord: createDiscordAdapter(),
    },
    threadContext: { maxMessages: 10 },
    chatOptions: { dedupeTtlMs: 600_000 },
  },
});
```

`dedupeTtlMs` overrides the instance-wide `chatOptions.dedupeTtlMs` for that platform only, and `threadContext.maxMessages` overrides the instance-wide `threadContext.maxMessages` (`0` disables the first-mention history fetch for that platform). Platforms that set neither keep the instance-wide value, so existing configuration is unchanged. `threadContext.addSystemMessage` stays instance-wide.
