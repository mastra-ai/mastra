---
'@mastra/core': minor
---

Added durable experiments. Pass `durable: true` to `startExperimentAsync()` and the experiment runs as an evented workflow with one step per item, so a process that stops or redeploys no longer leaves it stuck at `running`. With workers on a pubsub that redelivers events, such as Redis Streams, another worker picks up an item that was cut off, and each item still records one result.

```typescript
const { experimentId } = await dataset.startExperimentAsync({
  durable: true,
  targetType: 'agent',
  targetId: 'translation-agent',
  scorers: ['accuracy'],
});
```

Durable runs only accept options that can be stored, such as registered targets, scorer IDs, a `provider/modelId` `agentModel` and a plain JSON `requestContext`. Inline tasks, hooks, `onEvent`, `signal`, scorer objects and non-JSON `requestContext` values throw `EXPERIMENT_NOT_DURABLE` before anything is created. The caller's auth token, user, roles and permissions are removed from `requestContext` before the run is published or stored. Without `durable`, experiments run in process as before.

`runExperimentItem()` now also accepts `agentModel`, `itemTimeout`, `maxRetries`, `unmockedToolPolicy` and `versions`, and applies the item's tool mocks, so a caller-driven item behaves like an item in a native run.

An item whose `itemTimeout` expires while it waits to retry now fails with the timeout right away instead of waiting out the backoff, and result rows written by `runExperimentItem()` now keep the item's `metadata`.
