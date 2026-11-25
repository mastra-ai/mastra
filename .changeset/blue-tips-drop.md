---
'@mastra/factory': patch
---

Fixed Factory losing track of running agent runs when several Factory workers share a database. Each open run is now stored as its own row, so runs starting, heartbeating and ending on the same thread from different workers can no longer overwrite each other. During an upgrade, runs that a worker on the previous release still tracks in the thread's metadata are read there and left to that worker; once their owner is gone they move to the new storage.
