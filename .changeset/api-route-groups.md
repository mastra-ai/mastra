---
'@mastra/core': minor
---

Added route groups for API route factories that register multiple HTTP methods or paths. `registerApiRouteGroup()` preserves the primary route shape for direct consumers, while Mastra configuration and server adapters recursively flatten grouped routes before registration.
