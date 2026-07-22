---
'@mastra/code-sdk': patch
---

Fixed a crash (`TypeError: Cannot read properties of undefined (reading 'includes')`) when a Mastra store instance is injected into the SDK from a project whose dependency graph contains duplicate copies of @mastra/core. Injected stores are now detected structurally instead of with `instanceof`, so stores built against a different core copy are recognized correctly instead of being mistaken for a storage config.
