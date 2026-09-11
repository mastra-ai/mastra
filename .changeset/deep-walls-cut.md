---
'@mastra/core': patch
---

Fixed `Mastra.shutdown()` tearing down pub/sub before in-flight workflow runs could finish. Runs that were mid-step when `mastra.shutdown()` was called used to hang forever because the events they needed no longer had a consumer; durable agent runs were drained too late for the drain to help.

`shutdown()` now waits for in-flight workflow runs (plain and durable agent) to reach a finished or suspended state before stopping workers, bounded by a new `drainTimeout` option (default 5 seconds). Workers also wait for events they are already processing before tearing down. The timeout is one shared deadline for the whole shutdown, so a stuck step can never hold it open for longer than `drainTimeout`.

A durable agent whose terminal error event cannot be published (for example because the pub/sub client is already closing) now logs a warning instead of surfacing an unhandled rejection.

Note: the durable agent wait was previously unbounded. If you rely on `shutdown()` waiting longer than 5 seconds for durable agent runs, pass a larger `drainTimeout`.

```typescript
await mastra.shutdown({ drainTimeout: 30_000 });
```

Fixes https://github.com/mastra-ai/mastra/issues/22863
