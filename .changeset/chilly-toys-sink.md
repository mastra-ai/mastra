---
'@mastra/memory': minor
---

Observational memory now runs at most 3 Observer and Reflector model calls at once per process, across all threads. Previously, many threads crossing their thresholds together started that many runs at once, and the burst could stall every agent in the process. Runs beyond the limit wait their turn, and runs an agent step is waiting for start before background buffering.

Change the limit with the new `maxConcurrentModelCalls` option, or set `Infinity` to remove it:

```ts
new Memory({
  options: {
    observationalMemory: {
      enabled: true,
      maxConcurrentModelCalls: 4,
    },
  },
});
```
