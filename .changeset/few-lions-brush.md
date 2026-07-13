---
'@mastra/core': minor
---

Added bounded `Retry-After` handling to `StreamErrorRetryProcessor` through the new `maxRetryAfterMs` option.

Improved structured-output recovery so transport and provider failures are not retried with JSON prompt injection. V2+ scorer judges can use existing error processors for a coordinated retry budget; V1 judges continue to use `generateLegacy()` retries.

```ts
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

new StreamErrorRetryProcessor({
  maxRetries: 2,
  maxRetryAfterMs: 30_000,
});
```
