---
'@mastra/core': patch
---

`StreamErrorRetryProcessor` now decides retries with the shared provider-failure reader from `@mastra/core/error`, so it agrees with every other place Mastra reads a model-provider failure. It retries rate limits, provider outages and timeouts, and never retries a credential or quota refusal.

Fixed an exhausted quota being retried when the provider returned it as a retryable `429`. A stream error frame that reports an exhausted quota under a rate-limit code is no longer retried either, and `isBadRequestError` no longer matches a `400` that reports an exhausted credit balance, a usage cap, or a rejected API key.

Your own `matchers` now run before the built-in OpenAI Responses matcher, so their `maxRetries`, `delayMs` and `onRetry` apply when both match a stream error.
