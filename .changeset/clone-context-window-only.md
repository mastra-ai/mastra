---
'@mastra/memory': minor
---

Added `options.contextWindowOnly` to `memory.cloneThread()` and `memory.copyThread()`. Clones still copy every message by default. Pass `contextWindowOnly: true` to copy only what is still in the context window: the observations, plus the messages created after the memory's `lastObservedAt`. The earlier messages are not copied, because the observations already stand in for them.

```ts
const { thread } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  options: { contextWindowOnly: true },
});
```

**What a context-window clone keeps**

- With thread-scoped memory, the model sees the same context in the clone as in the source: the same observations and the same unobserved messages.
- With resource-scoped memory cloned within the same resource, the clone shares the source's observations, and the resource's context can hold both the source's unobserved messages and their copies.
- The source thread keeps every message.
- Without observational memory configured, or when it hasn't observed anything yet, every message is still copied.

**What it leaves out**

- The clone's stored message history holds only the copied messages, and thread-scoped semantic recall searches only those. Semantic recall with resource scope, the default, searches every thread of the resource, so in a clone within the same resource it can still return the source's earlier messages.
- A resource-scoped clone into another resource doesn't carry the unobserved messages of the source resource's other threads.

`contextWindowOnly` can't be combined with `messageFilter` or `messageLimit`. It is also accepted by the agent controller's thread clones and the server's clone-thread endpoint.
