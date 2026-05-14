---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed a workspace PATCH bug across the inmemory, libsql, and pg workspace adapters: omitted config fields in a PATCH no longer overwrite previously-persisted values with `undefined`. This is the same defect class as the matching agent / skill adapter fixes shipped previously.
