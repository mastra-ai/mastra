---
'@mastra/core': patch
---

Added `classifyProviderError`, `providerErrorFacts` and `providerErrorReason` to `@mastra/core/error`: one reader for model-provider failures (authentication, quota, rate limit, context overflow, rejected model or request, timeout, outage) that takes HTTP status and provider codes before wording. The stream error retry processor uses it, and persisted error parts keep the provider's `statusCode`, `code` and `reason` so a reloaded thread classifies like a live one. The `reason` comes from the provider's response, including one wrapped as another error's cause; any other cause stays out of thread history.

```ts
import { classifyProviderError } from '@mastra/core/error';

if (classifyProviderError(error) === 'rate_limited') {
  // wait, then retry
}
```
