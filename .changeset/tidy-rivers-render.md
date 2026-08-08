---
'@mastra/core': minor
---

Channel agent replies now post as markdown by default, so Slack renders bold text, links, and tables natively and other chat platforms convert the reply to their own format. Previously the final reply was posted as literal plain text, which made standard markdown show up as raw `**bold**` and `[title](url)` characters in Slack while the same reply rendered correctly in Studio.

This is a behavior change for every channel agent. If your agent was prompted to emit a platform dialect such as Slack mrkdwn to work around the old behavior, either remove those prompt instructions (recommended) or set the new `textFormat: 'plain'` option on the channel adapter config to keep posting literal plain text:

```typescript
channels: {
  adapters: {
    slack: {
      adapter: createSlackAdapter(),
      textFormat: 'plain',
    },
  },
},
```

`textFormat` applies to final reply text only. Tool cards, error messages, tripwire notices, and native streaming (which was already markdown) are unchanged. Postable channel messages now also accept a `{ markdown: string }` object alongside strings and card elements.
