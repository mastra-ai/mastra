---
'@mastra/memory': patch
---

Fixed synchronous observation error handling in Observational Memory. `observe()` now throws when synchronous (thread/resource-scoped) observation fails, instead of continuing silently with stale observations. Async buffered observation failures remain non-fatal.

