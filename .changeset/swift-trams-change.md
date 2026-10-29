---
'@mastra/server-adapters-test-suite': minor
---

Added `createStructuredWakeTestSuite` to check that idle-thread subscriptions receive structured results and validation errors before the terminal event on plain, durable, and evented agents.

Pass your adapter's scripted model fixture as `setupModel` and its real HTTP server factory as `startServer`:

```ts
import { createStructuredWakeTestSuite } from '@mastra/server-adapters-test-suite';

createStructuredWakeTestSuite({ setupModel, startServer });
```
