---
'@mastra/slack': minor
---

Added `replyMode` and `threadLink` to `SlackProvider` and Slack adapter configs. With `replyMode` set, tool calls are hidden by default instead of grouped.

```typescript
new SlackProvider({
  replyMode: 'tool',
  threadLink: ({ threadId }) => `https://app.example.com/threads/${threadId}`,
});
```
