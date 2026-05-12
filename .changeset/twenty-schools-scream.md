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

Wrapping `defaultHandler` is a clean way to gate the agent on per-user ACLs, rate limits, or audit logging without reimplementing dispatch:

```ts
new SlackProvider({
  baseUrl: process.env.MASTRA_BASE_URL,
  handlers: {
    onMention: async (thread, message, defaultHandler) => {
      if (!authorizedUserIds.includes(message.author.userId)) {
        console.log('Received a mention from an unauthorized user:', { userId: message.author.userId });
        return;
      }
      return defaultHandler(thread, message);
    },
    onDirectMessage: async (thread, message, defaultHandler) => {
      if (!authorizedUserIds.includes(message.author.userId)) {
        console.log('Received a DM from an unauthorized user:', { userId: message.author.userId });
        return;
      }
      return defaultHandler(thread, message);
    },
    onSubscribedMessage: async (thread, message, defaultHandler) => {
      if (!authorizedUserIds.includes(message.author.userId)) {
        console.log('Received a subscribed message from an unauthorized user:', { userId: message.author.userId });
        return;
      }
      return defaultHandler(thread, message);
    },
  },
});
```
