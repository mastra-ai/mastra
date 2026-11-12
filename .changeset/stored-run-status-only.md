---
'@mastra/core': patch
---

Thread subscribers checking whether a run is still parked now read only the stored run status instead of loading the whole run snapshot, which could be many megabytes per check.
