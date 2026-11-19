---
'@mastra/core': minor
---

Added `providerRequestOrigin` to `@mastra/core/error`, next to `providerRequestId` and `providerModelId`. It returns the scheme, host and port a failed model request was sent to (for example `https://gateway-api.mastra.ai`), also from a wrapped cause. It reads only the AI SDK's provider call error, because a `url` on any other error may name another resource.

Error parts saved to thread history for a failed model call now include the same value as `requestOrigin`. A UI that rebuilds the error from history can tell a Gateway error from a provider error with the same status. The path, query string and any credentials in the URL are not saved.

```ts
import { providerRequestOrigin } from '@mastra/core/error';

try {
  await agent.generate('Hello');
} catch (error) {
  if (providerRequestOrigin(error) === 'https://gateway-api.mastra.ai') {
    // The Mastra Gateway answered, not the model provider.
  }
}
```
