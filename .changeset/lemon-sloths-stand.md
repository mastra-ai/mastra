---
'@mastra/core': minor
'@mastra/factory': patch
'@mastra/slack': patch
---

Added `AgentChannels.onSdkReady(handler)`: run a callback with the Chat SDK instance once channel initialization constructs it (immediately when already initialized). The SDK is created lazily inside `initialize()`, so hosts that build their channels before the server boots can now register extra Chat SDK handlers — e.g. custom slash commands:

```ts
const channels = new AgentControllerChannels({ adapters, handlers });
channels.onSdkReady(chat => {
  chat.onSlashCommand('/mycommand', async event => {
    await event.channel.postEphemeral(event.user, 'hi', { fallbackToDM: false });
  });
});
```
