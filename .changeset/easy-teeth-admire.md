---
'@mastra/core': minor
---

Added an option to retry all stream errors and enabled resilient retries for coding agents.

```typescript
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

const processor = new StreamErrorRetryProcessor({
  retryAllErrors: true,
  maxRetries: 2,
  delayMs: 3000,
});
```
