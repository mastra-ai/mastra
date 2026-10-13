---
'@mastra/core': minor
---

Added authenticated message authors to AgentController sessions. Pass `author` to `sendMessage`, `queueMessage`, or `steer`, and read it back with `getMessageAuthor`.

```ts
await session.sendMessage({ content: 'Hi', author: { id: 'user-123' } });
const messages = await session.thread.listMessages({ threadId: session.thread.requireId() });
const message = messages.findLast(message => message.role === 'signal')!;
const author = getMessageAuthor(message);
```
