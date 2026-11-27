---
'@mastra/memory': minor
---

Changed thread clones to copy only the messages in the context window when observational memory is configured and the thread has observations: the ones created after the memory's `lastObservedAt`. The observations already carry the earlier messages, so the clone starts with the same context as the source without duplicating the whole conversation. This applies to `memory.cloneThread()`, `memory.copyThread()` (used by subagent forks), and the agent controller's thread clones. When both a thread and a resource record exist, the clone now carries the one the configured scope reads.

Without observational memory configured, or when it hasn't observed anything yet, clones still copy every message, and a `messageFilter` or `messageLimit` you pass still decides. To copy every message, pass an empty filter:

```ts
const { thread } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  options: { messageFilter: {} },
});
```
