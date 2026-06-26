---
'@mastra/core': minor
---

support inline JSON prompt injection

Widens the `jsonPromptInjection` type from `boolean` to
`boolean | 'system' | 'inline'`. `'inline'` injects the
JSON schema instruction into the latest user message
instead of the leading system message, preserving prompt
cache on providers with prefix-based caching. Also adds
a `'json-prompt-injection:inline'` feature flag for
runtime capability detection.
