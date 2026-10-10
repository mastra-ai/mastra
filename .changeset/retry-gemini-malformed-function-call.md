---
'@mastra/core': patch
---

Agents now recover from Gemini's intermittent `MALFORMED_FUNCTION_CALL` finish instead of failing the turn with `AGENT_STREAM_ERROR`. The default `stream-error-retry-processor` resends the failed step unchanged up to 2 times with a short backoff. No tool runs on that step, so the retry cannot repeat side effects. The matcher is exported as `isMalformedFunctionCallError` so custom `StreamErrorRetryProcessor` instances can reuse it.
