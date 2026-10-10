---
'@mastra/core': minor
---

Agents using the default error processors now recover from Gemini's intermittent `MALFORMED_FUNCTION_CALL` finish instead of failing the turn with `AGENT_STREAM_ERROR`. The default `stream-error-retry-processor` resends the failed step unchanged up to 2 times with a short backoff. No tool runs on that step, so the retry cannot repeat side effects. Durable agents are not covered yet.

The matcher is exported as `isMalformedFunctionCallError`, so a custom `StreamErrorRetryProcessor` can reuse it:

```ts
import { StreamErrorRetryProcessor, isMalformedFunctionCallError } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  errorProcessors: [new StreamErrorRetryProcessor({ matchers: [isMalformedFunctionCallError], maxRetries: 2 })],
});
```
