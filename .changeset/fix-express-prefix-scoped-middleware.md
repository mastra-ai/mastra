---
'@mastra/express': patch
---

Fixed context and auth middleware being applied globally instead of scoped to the configured route prefix. Routes outside the Mastra prefix (e.g. `/health`) are no longer affected by Mastra's authentication middleware.
