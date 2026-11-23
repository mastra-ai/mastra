---
'@mastra/core': minor
---

Added a `fallback` field to the `processAPIError` result. A processor can return `fallback: false` to stop trying the agent's fallback models for an error. The run then reports the original error, with its status code, response body and cause, as if the failing model were the last one in the list.

**Before:** a processor could only stop the fallback models by aborting the run, which then ended as a tripwire instead of the provider's error.

**After:**

```ts
import { classifyProviderError } from '@mastra/core/error';

const stopWhenOutOfCredits: Processor = {
  id: 'stop-when-out-of-credits',
  processAPIError: ({ error }) =>
    classifyProviderError(error) === 'quota' ? { retry: false, fallback: false } : undefined,
};
```

Leaving `fallback` unset keeps today's behaviour.

Also exported `getRetryAfterMs` and `PROVIDER_FAILURE_KINDS` from `@mastra/core/error`.
