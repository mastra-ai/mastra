---
'@mastra/client-js': patch
'@mastra/server': patch
'mastracode': patch
---

Fixed agent controller session snapshots to include the current task list so Mastra Code restores task progress after refreshes, thread changes, and connection recovery.
