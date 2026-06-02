---
'@mastra/core': minor
---

Added `channels.resolveResourceId` to control which `resourceId` owns a channel thread's memory, separately from who sent the message. Useful for SSO apps that want a user's memory shared across web and a Feishu/Lark DM, or group chats scoped to the conversation instead of the sender. Only affects newly-created threads; return the provided default to keep current behavior.

```ts
new Agent({
  // ...
  channels: {
    adapters: { slack: createSlackAdapter() },
    resolveResourceId: async ({ thread, message }) => {
      if (thread.isDM) return resolveSsoUserId(message); // shared with web
      return thread.channelId; // group owns the memory
    },
  },
});
```
