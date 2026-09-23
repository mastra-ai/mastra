---
'@mastra/core': patch
---

Fixed delayed workflow result writes from a deleted run lifetime being able to merge stale step output into a reopened lifetime's snapshot: updateWorkflowResults callsites now carry the run's executionGeneration so storage can fence stale-lifetime writes.
