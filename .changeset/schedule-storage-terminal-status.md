---
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mysql': patch
'@mastra/pg': patch
'@mastra/spanner': patch
---

Added support for recording a schedule's terminal status in the same atomic update that claims its final firing. A schedule whose cron has no future occurrence is now stored as `completed` instead of staying `active`, so its last occurrence is delivered once instead of on every tick.

Upgrade this store alongside `@mastra/core`. A store that predates this argument leaves the row `active`, and the scheduler re-fires that final occurrence on each tick.
