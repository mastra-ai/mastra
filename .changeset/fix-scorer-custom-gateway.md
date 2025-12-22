---
'@mastra/core': patch
---

Scorers now have access to custom gateways when resolving models. Previously, calling `resolveModelConfig` in the scorer didn't pass the Mastra instance, so custom gateways were never available.
