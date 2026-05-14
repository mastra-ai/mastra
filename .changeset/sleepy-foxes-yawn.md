---
'@mastra/libsql': patch
---

Fixed a workspace PATCH bug: omitted config fields in a PATCH no longer overwrite previously-persisted values with `undefined`.
