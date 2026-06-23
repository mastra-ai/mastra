---
'@mastra/core': patch
---

Added an optional `delayMs` retry delay to `StreamErrorRetryProcessor`. Consumers can now wait before retrying transient errors, accepting either a fixed number of milliseconds or a function evaluated with the error args. Existing default behavior is unchanged when the option is not supplied.

```ts
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

new StreamErrorRetryProcessor({
  maxRetries: 2,
  delayMs: ({ retryCount }) => Math.min(1000 * 2 ** retryCount, 30000),
  matchers: [error => error?.code === 'ECONNRESET'],
});
```
