---
'@mastra/core': minor
---

Added `maxRetryAfterMs` to `StreamErrorRetryProcessor`, with a default of 30 seconds, so provider `Retry-After` waits can't exceed a configured limit.

Improved structured-output recovery so transport and provider failures don't trigger JSON prompt injection. Scorer judges that use Mastra's current generation API can use existing error processors for a coordinated retry budget. Legacy model adapters keep their separate `generateLegacy()` retry settings.

**Before**

```ts
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

new StreamErrorRetryProcessor({
  maxRetries: 2,
});
```

**After**

```ts
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

new StreamErrorRetryProcessor({
  maxRetries: 2,
  maxRetryAfterMs: 30_000,
});
```
