---
'@mastra/factory': minor
---

Added Slack channel adapter options to `SlackIntegration` and made concise thinking, typing, and working statuses the default.

```ts
new SlackIntegration({
  signingSecret,
  adapterOptions: {
    streaming: true,
    toolDisplay: 'grouped',
  },
});
```
