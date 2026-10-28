---
'@mastra/core': minor
---

Channel `formatError` now receives the failed run's request context as a second argument, so the message posted to Slack, Discord, Teams or Telegram can link back to whatever the run belongs to. Formatters that take only the error keep working. When a stream fails with a raw provider payload instead of an `Error`, the error passed to `formatError` keeps that payload as its `cause`, so the formatter can still tell what failed.

```ts
channels: {
  adapters: {
    slack: {
      adapter: createSlackAdapter(),
      formatError: (error, { requestContext }) => {
        const ticketId = requestContext?.get('ticketId');
        return ticketId ? `❌ ${error.message} (ticket ${ticketId})` : `❌ ${error.message}`;
      },
    },
  },
},
```
