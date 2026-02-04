---
'mastra': patch
---

Fixed peer dependency checker fix command to suggest the correct package to upgrade:
- If peer dep is too old (below range) → suggests upgrading the peer dep (e.g., `@mastra/core`)
- If peer dep is too new (above range) → suggests upgrading the package requiring it (e.g., `@mastra/libsql`)
