---
"@mastra/core": minor
---

Add experimental `agent.sendMessage()` and `agent.queueMessage()` APIs for sending user-authored input into agent threads.

```ts
await agent.sendMessage('Continue with the latest user input', { resourceId, threadId });
await agent.queueMessage({ contents: 'Follow up after the active turn finishes' }, { resourceId, threadId });
```

This also normalizes signal categories so user messages use `type: 'user'` with `tagName: 'user'`, while preserving compatibility for legacy `user-message` and `system-reminder` signal payloads and stored records.
