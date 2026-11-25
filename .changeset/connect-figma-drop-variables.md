---
'@mastra/connect': patch
---

Removed the Figma variable tools (`figma_get_local_variables`, `figma_get_published_variables`, `figma_update_variables`). Figma only grants their scopes to Enterprise organization members, so on every other plan they always failed.
