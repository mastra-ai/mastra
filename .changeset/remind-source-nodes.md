---
'@mastra/memory': patch
---

Reminder signals now include the knowledge nodes they cite in `attributes.sourceNodes` (node id, name and, for knowledge records, the record id), so interfaces can link a reminder to its sources. `attributes.sourceIds` is unchanged.
