---
'@mastra/core': minor
---

Added `classifyProviderError`, `providerErrorReason` and `toPersistedErrorIdentity` to `@mastra/core/error`: one reader for model-provider failures (authentication, quota, rate limit, context overflow, rejected model or request, timeout, outage) that takes HTTP status and provider codes before wording. A status from the GitHub API or a storage call is not mistaken for the model provider's. `providerRequestId` and `providerModelId` return the provider's request id and the model the failed request named, also from a wrapped cause, and `PROVIDER_CALL_ERROR_NAME` matches the name of the AI SDK's provider call error.

Saved error parts now also keep every provider code as `codes` and the provider's `reason` sentence, so a reloaded thread classifies like a live one, including a failure the provider reported mid-stream. `toPersistedErrorIdentity(error)` returns that saved shape, so anything that sends an error to a client can send the same one. The `reason` comes from the provider's response, including a string `detail` field and a response wrapped as another error's cause; any other cause stays out of thread history, and a long reason is cut at 2,000 characters.

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
