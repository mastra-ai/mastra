---
'@mastra/core': minor
---

Added `classifyProviderError`, `providerErrorFacts` and `providerErrorReason` to `@mastra/core/error`: one reader for model-provider failures (authentication, quota, rate limit, context overflow, rejected model or request, timeout, outage) that takes HTTP status and provider codes before wording. Persisted error parts also keep every provider code as `codes` and the provider's `reason` sentence, so a reloaded thread classifies like a live one. The `reason` comes from the provider's response, including a string `detail` field and a response wrapped as another error's cause; any other cause stays out of thread history.

Each kind names a recovery action. New kinds can arrive in minor releases, and no kind is renamed or removed within 1.x, so keep a default branch when you switch on one:

```ts
import { classifyProviderError } from '@mastra/core/error';

switch (classifyProviderError(error)) {
  case 'rate_limited':
    // wait, then retry
    break;
  case 'quota':
    // ask for more credit
    break;
  default:
    // show the provider's reason
}
```
