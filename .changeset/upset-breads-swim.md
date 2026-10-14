---
'@mastra/client-js': minor
---

Added `agent.queueSignal()` for queuing a typed signal behind the active thread run.

```ts
await agent.queueSignal({
  signal: { type: 'reactive', tagName: 'skill', attributes: { name: 'triage' }, contents: 'Triage the new issue.' },
  resourceId: 'user-123',
  threadId: 'thread-abc',
});
```
