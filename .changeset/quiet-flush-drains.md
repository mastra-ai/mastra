---
'@mastra/observability': patch
---

Fixed spans being reported as aborted with "Observability is shutting down." in Braintrust, LangSmith and PostHog when calling `flush()` and then `shutdown()` right away, as in serverless handlers. `flush()` and `shutdown()` now finish processing queued span events first, so only spans that are really still open get aborted. Fixes [#26137](https://github.com/mastra-ai/mastra/issues/26137).
