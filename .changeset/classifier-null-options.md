---
'@mastra/core': patch
---

Fixed saving builder workflows with classifier steps when the model sends `null` for `maxRetries` or `providerOptions`. These values are now treated as omitted, the same as `retries` and `metadata`, instead of failing validation.
