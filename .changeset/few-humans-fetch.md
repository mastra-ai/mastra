---
'@mastra/client-js': patch
---

Added the retry fields the agent controller already emits (`retryable`, `retryDelay`, `retryAttempt`, `maxRetries`) to the `error` event type, so clients can tell a failure the controller is retrying from one that ended the run.
