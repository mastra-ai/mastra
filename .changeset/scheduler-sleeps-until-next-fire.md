---
'@mastra/core': patch
---

Improved the scheduler so it no longer queries storage every 10 seconds when nothing is due. It now waits until the next schedule is due, and with no active schedules it waits without any timer. Schedules created, updated or resumed through Mastra wake it right away; a schedule written straight to storage is noticed at the next wake or restart. Servers that share a store but not a pubsub (the default pubsub is per-process) only learn about schedules created elsewhere if they use a shared pubsub or turn on `scheduler: { enabled: true }`, which keeps checking at the configured interval.

If a dedicated scheduler process must pick up schedules written by other processes or straight to storage, keep it polling:

```ts
// Before: polled storage every 10 seconds by default.
// After: sleeps until the next fire. Opt back in to polling where you need it.
const mastra = new Mastra({ scheduler: { enabled: true } });
```
