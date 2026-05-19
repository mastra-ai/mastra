---
'@mastra/core': minor
---

Added support for registering a single Harness with `harness`, available as the `default` harness.

```ts
const mastra = new Mastra({ agents, storage, harness });
const defaultHarness = mastra.getHarness();
```

Registered Harness instances now shut down as part of `mastra.shutdown()`. Mastra attempts every
registered harness shutdown, logs individual harness failures, and throws the first harness shutdown
failure after the remaining cleanup steps have been attempted. Apps that use the existing
`harnesses` map can keep calling `mastra.getHarness('name')`.

`stopWorkers()` also now attempts every owned cleanup step before returning: worker stops, workflow
push subscription cleanup, user event listener cleanup, and pubsub flushing. If cleanup fails, Mastra
logs each failure and throws the first error after the remaining cleanup steps have been attempted.
