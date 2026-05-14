---
'@mastra/libsql': patch
---

Fixed a workspace PATCH bug: omitted config fields in a PATCH no longer overwrite previously-persisted values with `undefined`. Same defect class as the matching agent / skill adapter fixes shipped previously.
