---
"@mastra/core": patch
---

feat(core): add VoyageAI provider support to ModelRouter

Adds `voyage/` prefix support to `ModelRouterEmbeddingModel` for VoyageAI models
(e.g., `voyage/voyage-3.5`). Requires `@mastra/voyageai` or `voyageai` package.
