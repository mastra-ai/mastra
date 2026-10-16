---
'@mastra/connect': patch
---

Provides an internal helper for Knowledge importers to reconcile nodes they own against provider status. It removes records only after a positive removal response and preserves a resumable cursor.
