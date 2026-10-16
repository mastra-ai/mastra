---
'@mastra/code-sdk': patch
---

Added `normalizeLegacyProviderId` to `@mastra/code-sdk/providers/model-ids`: it maps a provider id Mastra Code once defined itself, such as `kimi-for-coding`, to the catalog id models.dev uses, `kimi-code-plan-cn`, so a reply's provider can be matched against the catalog.
