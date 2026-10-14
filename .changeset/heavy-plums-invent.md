---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Added `queueSignal()` to `Agent` and AgentController `Session`. It queues a typed signal behind the active run like `queueMessage()`, but keeps the signal type, tag, and attributes instead of turning it into a plain user message.

```ts
agent.queueSignal(
  { type: 'reactive', tagName: 'skill', attributes: { name: 'triage' }, contents: 'Triage the new issue.' },
  { resourceId: 'user-123', threadId: 'thread-abc' },
);
```

Runs started by a signal now record it on the `AGENT_RUN` span as `attributes.signal` (`id`, `type`, `tagName`, `attributes`), so traces show which signal started a run.
