---
'@mastra/core': patch
---

Fixed a workspace PATCH bug in the inmemory workspace adapter: omitted config fields in a PATCH no longer overwrite previously-persisted values with `undefined`.
