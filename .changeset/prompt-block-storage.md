---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/libsql': patch
---

Added `requestContextSchema` field to prompt block storage types, enabling prompt blocks to define their own variables schema. Prompt block server endpoints now compute a `hasDraft` indicator for accurate draft/published badge display. LibSQL stores automatically migrate to add the new column on existing databases.
