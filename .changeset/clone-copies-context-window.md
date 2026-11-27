---
'@mastra/memory': minor
---

Changed thread clones of observed threads to copy only the messages still in the context window. When observational memory is configured and the source thread has observations, a clone now copies only the messages created after the memory's `lastObservedAt`, plus the observations themselves. The earlier messages are not copied, because the observations already stand in for them.

**What stays the same**

- The model sees the same context in the clone as in the source: the same observations and the same unobserved messages.
- The source thread keeps every message.
- Threads without observational memory configured, or whose memory hasn't observed anything yet, still copy every message.
- A `messageFilter` or `messageLimit` you pass still decides which messages are copied.

**Where it applies**

`memory.cloneThread()`, `memory.copyThread()` (which subagent forks use), the agent controller's thread clones (including Mastra Code's thread clone), and the server's clone-thread endpoint.

**Getting a full copy**

Pass an empty message filter to copy every message, as before:

```ts
const { thread } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  options: { messageFilter: {} },
});
```
