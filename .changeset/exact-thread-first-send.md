---
'@mastra/server': patch
'@mastra/client-js': patch
---

Agent controller `sendMessage` and `switchModel` now accept an optional `threadId`. When the call is the first request to reach a session, the session binds to that exact thread instead of a new random-id thread. Before, a message sent while session setup was still in flight could be saved to a thread the client never reads.

```ts
await session.sendMessage('Hello', { threadId: sessionThreadId });
await session.switchModel('openai/gpt-5.5', { threadId: sessionThreadId });
```
