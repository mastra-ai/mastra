---
'@mastra/core': patch
---

Added an optional retry delay and an opt-in ECONNRESET error matcher to `StreamErrorRetryProcessor`. Consumers can now wait before retrying transient network-reset errors. Existing default behavior is unchanged when the new options are not supplied.

```ts
import { StreamErrorRetryProcessor, isECONNRESETError } from '@mastra/core/processors';

new StreamErrorRetryProcessor({
  maxRetries: 2,
  delayMs: 1000,
  matchers: [isECONNRESETError],
});
```
