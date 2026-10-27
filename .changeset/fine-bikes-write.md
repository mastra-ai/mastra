---
'@mastra/factory': minor
---

Added Slack Socket Mode support to Factory integrations, including transport-specific credential validation and clean connection shutdown.

```ts
new SlackIntegration({
  mode: 'socket',
  appToken: process.env.SLACK_APP_TOKEN!,
  botToken: process.env.SLACK_APP_BOT_TOKEN!,
});
```
