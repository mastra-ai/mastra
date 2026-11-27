---
'@mastra/memory': minor
---

Changed thread clones of observed threads to copy only the messages still in the context window. When observational memory is configured and the source thread has observations, a clone now copies only the messages created after the memory's `lastObservedAt`, plus the observations themselves. The earlier messages are not copied, because the observations already stand in for them.

**What stays the same**

- With thread-scoped memory, or resource-scoped memory cloned within the same resource, the model sees the same context in the clone as in the source: the same observations and the same unobserved messages.
- The source thread keeps every message.
- Without observational memory configured, or when it hasn't observed anything yet, clones still copy every message.
- A `messageFilter` or `messageLimit` you pass still decides which messages are copied.

**What changes**

- The clone's stored message history holds only the copied messages, and thread-scoped semantic recall searches only those. Semantic recall with resource scope, the default, searches every thread of the resource, so in a clone within the same resource it can still return the source's earlier messages.
- A resource-scoped clone into another resource doesn't carry the unobserved messages of the source resource's other threads.

**Where it applies**

`memory.cloneThread()`, `memory.copyThread()` (which subagent forks use), the agent controller's thread clones (including Mastra Code's thread clone), and the server's clone-thread endpoint.

**Getting a full copy**

Pass `fullThread: true` to copy every message. It can't be combined with `messageFilter` or `messageLimit`.

```ts
const { thread } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  options: { fullThread: true },
});
```
