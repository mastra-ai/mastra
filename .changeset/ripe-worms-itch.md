---
'@mastra/core': patch
---

Reduced the size of @mastra/core and of every bundle that includes it by more than 200 KB: the built-in provider registry no longer stores each provider's model list twice. Model lists, `PROVIDER_REGISTRY` and `GatewayRegistry.getModels()` return the same data as before.
