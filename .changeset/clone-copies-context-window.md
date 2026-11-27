---
'@mastra/memory': minor
---

Changed thread clones to copy only the messages in the context window when the thread has observational memory: the ones created after the memory's `lastObservedAt`. The observations already carry the earlier messages, so the clone starts with the same context as the source without duplicating the whole conversation. This applies to `memory.cloneThread()`, `memory.copyThread()` (used by subagent forks), and the agent controller's thread clones.

Threads without observational memory, or whose memory hasn't observed anything yet, still copy every message, and a `messageFilter` or `messageLimit` you pass still decides. To copy every message, pass an empty filter:

```ts
const { thread } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  options: { messageFilter: {} },
});
```
