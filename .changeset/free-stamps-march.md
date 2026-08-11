---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Added a helper that resolves a provider's low-cost observational-memory model, returning nothing for providers that have no such model instead of falling back to an unrelated one.

```ts
resolveBuiltinProviderOMModelId('anthropic'); // 'anthropic/claude-haiku-4-5'
resolveBuiltinProviderOMModelId('xai'); // undefined
```
