---
'@mastra/core': patch
---

Fixed error-processor retries being dropped when a run reached its `maxSteps` limit. An agent run with `maxSteps: 1` that hit a transient 429/5xx would previously resolve as a successful empty (or partial) response with `finishReason: 'retry'`. Retries now re-run the failed step without counting against `maxSteps`, and if every retry fails the run ends with `finishReason: 'error'` and the last provider error (including fields like `statusCode`) on `output.error` and `onError`, on the default, durable, and evented engines.
