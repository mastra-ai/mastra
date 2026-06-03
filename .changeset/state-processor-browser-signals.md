---
"@mastra/core": minor
---

Add processor state signals for memory-backed thread context.

Processors can now publish named state lanes with `computeStateSignal()`, and external producers can update the same lanes with `agent.sendStateSignal()`. The runtime tracks each lane by `id`, `cacheKey`, and `mode`, so unchanged state is deduped and snapshot/delta history can be replayed efficiently.

Browser context now uses this state-signal path, so browser state is represented as thread state instead of being injected as ad hoc context.

```ts
// External producer: push browser state outside a model run.
await agent.sendStateSignal(
  {
    id: 'browser',
    cacheKey: 'tab-42:https://app.example.com/dashboard',
    mode: 'snapshot',
    contents: 'Browser is open on https://app.example.com/dashboard',
    value: { url: 'https://app.example.com/dashboard', title: 'Dashboard' },
  },
  { resourceId, threadId, ifIdle: { behavior: 'persist' } },
);

// Processor-owned state: compute state before the model request.
const browserProcessor = {
  id: 'browser-state',
  stateId: 'browser',
  async computeStateSignal({ lastSnapshot }) {
    const nextBrowserState = await getBrowserState();

    return {
      cacheKey: nextBrowserState.url,
      mode: 'snapshot',
      contents: `Browser is open on ${nextBrowserState.url}`,
      value: nextBrowserState,
    };
  },
};
```
