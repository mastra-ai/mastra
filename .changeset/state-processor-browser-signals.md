---
"@mastra/core": minor
---

Add state signals for named thread context lanes

State signals let processors maintain typed, versioned state on threads that
dedupes across active runs and replays efficiently with snapshot/delta support.

```ts
// External producer: push state from outside a run
await agent.sendStateSignal({
  threadId,
  resourceId,
  stateId: 'browser',
  cacheKey: 'session-42',
  mode: 'snapshot',
  message: 'User navigated to /dashboard',
  contents: { url: 'https://app.example.com/dashboard', title: 'Dashboard' },
});

// Processor-owned state: compute on demand in a processor step
const myProcessor = {
  id: 'my-state',
  async computeStateSignal({ lastSnapshot, deltasSinceSnapshot, sendStateSignal }) {
    const state = computeFromDeltas(lastSnapshot, deltasSinceSnapshot);
    await sendStateSignal({
      mode: 'delta',
      message: 'State updated',
      contents: state,
    });
  },
};
```
