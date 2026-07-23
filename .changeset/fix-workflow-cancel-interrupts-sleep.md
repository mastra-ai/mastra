---
'@mastra/core': patch
---

Fixed `Run.cancel()` so it interrupts an in-flight `.sleep()` / `.sleepUntil()` immediately instead of waiting for the full duration.

Previously the default execution engine's sleep used a plain `setTimeout` that ignored the run's abort signal. A run canceled during a long sleep would keep a timer alive for the whole duration (e.g. `.sleepUntil(+24h)` held the run in memory for 24 hours), then wake up and overwrite the `'canceled'` status with `'running'` and publish a sleep-step `success` — so observers saw the run flip from `canceled` → `running` → `canceled`.

Now the sleep races against the abort signal: the timer is cleared on cancel (and `unref`'d so a long sleep never keeps the process alive on its own), the downstream step never runs, and the run settles as `canceled` right away without persisting `running` or a sleep-step `success`.

```ts
const run = await workflow.createRun();
const result = run.start({ inputData: {} });
setTimeout(() => run.cancel(), 1000); // during .sleep(60_000)

// Before: resolves after ~60s, status briefly flips back to running
// After:  resolves promptly with status 'canceled'
await result;
```
