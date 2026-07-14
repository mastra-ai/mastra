---
'@mastra/core': minor
---

Added an option to retry unknown stream errors while allowing known authorization failures to surface immediately, and enabled resilient retries for coding agents.

```typescript
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

const processor = new StreamErrorRetryProcessor({
  retryUnknownErrors: true,
  maxRetries: 2,
  delayMs: 3000,
});
```
