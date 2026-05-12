---
'@mastra/slack': minor
---

Added `adapter` and `channels` options to `SlackProvider` so you can configure the underlying `SlackAdapter` and `AgentChannels` the same way you would when wiring them up manually — for example, overriding event `handlers`, switching the adapter to socket mode, or customizing `inlineMedia` / per-adapter rendering.

```ts
new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  adapter: { mode: 'socket', appToken: process.env.SLACK_APP_TOKEN },
  channels: {
    handlers: {
      onDirectMessage: async (thread, message, defaultHandler) => {
        console.log('DM:', message.text);
        await defaultHandler(thread, message);
      },
    },
    inlineMedia: ['image/*', 'video/*'],
    adapterConfig: { cards: false },
  },
});
```

Provider-managed fields (`botToken`, `signingSecret`, `userName`, etc.) still come from each installation and aren't overridable.
