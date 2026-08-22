---
'@mastra/loggers': minor
---

`PinoLogger` now implements the Mastra logger adapter contract. During traced operations, a pino mixin injects `trace_id` and `span_id` into every native log record (stdout, files, and custom transports), and the observability log export is derived from the same record. User-supplied `mixin` fields are preserved, with trace fields taking precedence on conflict.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

export const mastra = new Mastra({
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
});

// During a traced run, stdout lines carry matching trace context:
// {"level":30,"name":"Mastra","trace_id":"0af7651916cd43dd8448eb211c80319c","span_id":"b7ad6b7169203331","msg":"tool executed"}
```
