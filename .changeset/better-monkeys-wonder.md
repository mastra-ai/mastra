---
'@mastra/core': minor
---

Fixed `DurableAgent.observe(runId)` when attaching to a run from another process.

- Restored the agent's configured output processors, request context, and `returnScorerData` setting, including when the observing process also runs durable steps.
- Preserved live call-time processors, request context, and scorer data when another wrapper observes the run within the same Mastra instance.
- **Behavior change:** Cross-process `DurableAgent.observe(runId)` now throws `DURABLE_AGENT_OBSERVE_AGENT_MISMATCH` when the persisted run belongs to an agent with a different ID, matching `resume()` and `recover()`. Use the same agent ID in the observing process as in the process that started the run.
- Made durable stream `onChunk` callbacks run serially and in order.
- Made `onFinish` wait for pending `onChunk` callbacks to finish, without waiting for transport acknowledgements.

**Before:** An observing process could use a different agent ID to attach to a run started by `researcher`:

```ts
const observer = createDurableAgent({
  agent: new Agent({ ...agentConfig, id: 'researcher-observer' }),
  pubsub,
});
// After registering observer with Mastra and the shared storage:
await observer.observe(runId);
```

**After:** Use the starting agent's ID in the observing process. The previous configuration now throws `DURABLE_AGENT_OBSERVE_AGENT_MISMATCH`:

```ts
const observer = createDurableAgent({
  agent: new Agent({ ...agentConfig, id: 'researcher' }),
  pubsub,
});
// After registering observer with Mastra and the shared storage:
await observer.observe(runId);
```
