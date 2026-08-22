---
'@mastra/core': minor
---

Added a logger adapter contract (`AdaptableLogger` in `@mastra/core/logger`) for trace-correlated log output. Loggers implementing the adapter inject `trace_id` and `span_id` into their native log records during traced operations, and the observability `LogEvent` is derived from that same record. The built-in `ConsoleLogger` implements the contract. A new `loggerOptions` config on `Mastra` controls the behavior:

```typescript
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  loggerOptions: {
    correlation: true, // inject trace_id/span_id into native output (default: true)
    export: true, // forward log records to observability storage (default: true)
  },
});
```

Custom `IMastraLogger` implementations without adapter support continue to work through the existing dual-write wrapper, which is now deprecated and will be removed in the next major version.
