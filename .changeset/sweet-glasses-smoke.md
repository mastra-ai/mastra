---
'@mastra/code-sdk': patch
---

Fixed headless runs failing with "Unknown model" when the model catalog could not be loaded. If the catalog lists no models for the provider, a model whose provider is in the bundled registry and whose credentials are set now runs, with a warning. Malformed model ids and unknown providers are still rejected. This works with every `@mastra/core` version the package supports, including those without `AgentController.getModelAuthStatus`.
