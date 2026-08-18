---
'@mastra/core': minor
---

Added a logger adapter contract for trace-correlated log output. Loggers implementing the adapter (`PinoLogger`, `ConsoleLogger`) now inject `trace_id` and `span_id` into their native log records during traced operations, and the observability `LogEvent` is derived from that same record. A new `loggerOptions` config on `Mastra` controls the behavior:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

export const mastra = new Mastra({
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  loggerOptions: {
    correlation: true, // inject trace_id/span_id into native output (default: true)
    export: true, // forward log records to observability storage (default: true)
  },
});
```

Custom `IMastraLogger` implementations without adapter support continue to work through the existing dual-write wrapper, which is now deprecated and will be removed in the next major version.
