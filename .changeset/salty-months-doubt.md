---
'@mastra/pg': patch
---

Fixed saveThread to merge metadata on conflict instead of replacing it, preventing data loss when concurrent writes update thread metadata during an agent run
