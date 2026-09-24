---
'@mastra/core': minor
---

Added an `engine` option to durable agents so the agentic loop can run on the evented execution engine. With `engine: 'evented'`, every loop step is dispatched through the workflows pubsub topic and executed by a workflow worker — enabling `--workers` dedicated deployments where the API tier publishes durable agent runs and a separate worker process executes them, while streaming and `observe()` keep flowing to the caller over pubsub.

```ts
const durableAgent = createDurableAgent({
  agent,
  engine: 'evented', // default: 'default' (in-process execution, unchanged)
});
```

Also fixed the evented engine losing the workflow's initial input (`getInitData()`) mid-run and on resume when `shouldPersistSnapshot` opts out of persisting `running` checkpoints.
