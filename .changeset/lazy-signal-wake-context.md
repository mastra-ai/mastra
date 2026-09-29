---
'@mastra/core': patch
---

Fixed signals sent to a running agent session losing their request context when the run finished before the signal landed. The signal then woke the idle thread without the controller context, and runs failed with "No model available: controller session context" on every retry.

Signals and notifications sent during an active run now carry their wake context, which is built only if the signal actually wakes an idle thread. Signals taken by the live run skip that setup and keep its abort state intact.

`ifIdle.streamOptions` on `agent.sendSignal()` also accepts a function that returns the options, resolved only when the signal wakes the thread:

```ts
await agent.sendSignal(signal, {
  resourceId,
  threadId,
  ifIdle: { streamOptions: async () => ({ requestContext }) },
});
```
