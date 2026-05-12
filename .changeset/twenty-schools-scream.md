---
'@mastra/slack': minor
---

`SlackProvider` now accepts the channel-level options you'd pass to `AgentChannels` when wiring it up manually — for example overriding event `handlers`, per-adapter rendering via `adapterConfig` (`cards`, `formatToolCall`, `formatError`), and `inlineMedia` / `inlineLinks` / `chatOptions`. Also forwards a `logger` to the underlying `SlackAdapter`.

```ts
new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  inlineMedia: ['image/*', 'video/*'],
  adapterConfig: {
    cards: false,
    formatToolCall: ({ toolName, result }) => ({ text: `\`${toolName}\` → ${JSON.stringify(result)}` }),
  },
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler) => {
      console.log('DM:', message.text);
      await defaultHandler(thread, message);
    },
  },
});
```
