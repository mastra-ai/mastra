---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/factory': patch
---

`@mastra/core/error` exports `classifyProviderError`, `providerErrorFacts` and `providerErrorReason`: one classifier for model-provider failures (authentication, quota, rate limit, context overflow, rejected model or request, timeout, outage) that reads HTTP status and provider codes before wording. Persisted error parts and the agent-controller stream's flattened errors now keep the provider's `statusCode`, `code` and body `reason` when the failure carried them, so a live notice and a reloaded thread classify the same way. Observational memory's context-overflow detection and the stream error retry processor use the shared classifier, and the factory dispatcher marks any provider authentication failure as credentials unavailable instead of only HTTP 401 and 403.
