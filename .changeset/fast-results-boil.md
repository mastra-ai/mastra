---
'@mastra/core': minor
---

Added authenticated message authors to AgentController sessions. Pass `author` to `sendMessage`, `queueMessage`, or `steer`, and read it back with `getMessageAuthor`.

```ts
await session.sendMessage({ content: 'Hi', author: { id: 'user-123' } });
const author = getMessageAuthor(message);
```
