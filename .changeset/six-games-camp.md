---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Improved scheduler efficiency: the tick loop now auto-suspends when no active schedules remain in the database, stopping unnecessary polling every 10 seconds. The scheduler automatically restarts when a new workflow with a schedule is registered. This prevents wasted database queries in deployments where scheduled workflows are removed or not yet configured.
