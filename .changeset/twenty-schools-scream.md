---
'@mastra/slack': minor
---

`SlackProvider` now accepts the same configuration options you'd pass to `SlackAdapter` and `AgentChannels` when wiring them up manually — for example, overriding event `handlers`, switching the adapter to socket mode, or customizing `inlineMedia` / per-adapter rendering.

```ts
new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  mode: 'socket',
  appToken: process.env.SLACK_APP_TOKEN,
  inlineMedia: ['image/*', 'video/*'],
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler) => {
      console.log('DM:', message.text);
      await defaultHandler(thread, message);
    },
  },
  adapterConfig: { cards: false },
});
```

Provider-managed fields (`botToken`, `signingSecret`, `userName`, etc.) still come from each installation and aren't overridable.
