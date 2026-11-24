---
'@mastra/factory': patch
---

Fixed Factory losing track of running agent runs when several Factory workers share a database. Each open run is now stored as its own row, so runs starting, heartbeating and ending on the same thread from different workers can no longer overwrite each other. Runs that were open before upgrading are carried over the first time they are read.
