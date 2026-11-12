---
'@mastra/core': patch
---

Reduced memory use and garbage-collection pauses for thread subscribers. Checking whether a run is still parked now reads only the stored run status instead of loading the whole run snapshot, which could be many megabytes per check.
