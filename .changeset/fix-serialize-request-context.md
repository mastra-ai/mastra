---
'@mastra/core': patch
'@mastra/libsql': patch
---

**Fixed** Workflow runs no longer fail to persist when request context contains non-serializable values (for example functions, circular references, or platform proxy objects). This prevents errors when saving workflow snapshots and scorer results. See #12301.
