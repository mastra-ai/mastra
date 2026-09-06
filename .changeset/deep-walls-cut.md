---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fixed `Mastra.shutdown()` tearing down pub/sub before in-flight workflow runs could finish. Runs started with `mastra.shutdown()` mid-step used to hang forever because the events they needed no longer had a consumer; durable agent runs were drained too late for the drain to help.

`shutdown()` now waits for in-flight workflow runs (plain and durable agent) to reach a finished or suspended state before stopping workers, bounded by a new `drainTimeout` option (default 5 seconds). Workers also wait for events they are already processing before tearing down.

```typescript
await mastra.shutdown({ drainTimeout: 30_000 });
```

Fixes https://github.com/mastra-ai/mastra/issues/22863
