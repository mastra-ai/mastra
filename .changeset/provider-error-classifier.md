---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/factory': patch
---

`@mastra/core/error` exports `classifyProviderError`, `providerErrorFacts` and `providerErrorReason`: one classifier for model-provider failures (authentication, quota, rate limit, context overflow, rejected model or request, timeout, outage) that reads HTTP status and provider codes before wording. Persisted error parts now keep the provider's `statusCode` and `code` when the failure carried them, so a reloaded thread can be classified like a live one. Observational memory's context-overflow detection and the stream error retry processor use the shared classifier, and the factory dispatcher marks any provider authentication failure as credentials unavailable instead of only HTTP 401 and 403.
