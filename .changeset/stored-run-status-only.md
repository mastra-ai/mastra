---
'@mastra/core': patch
---

Reduced memory use and garbage-collection pauses for thread subscribers on storage adapters that can read a run's status on its own, such as Postgres. Checking whether a run is still parked now asks storage only for the run status instead of loading the whole run snapshot, which could be many megabytes per check. Adapters without a status-only read still load the snapshot.
