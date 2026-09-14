---
'@mastra/editor': patch
---

Preserve code-defined scorers when stored scorer definitions are updated, deleted, or evicted from the Editor cache. Only remove stored-owned runtime registrations at the exact definition key.
