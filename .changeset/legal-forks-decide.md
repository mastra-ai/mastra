---
'@mastra/core': patch
---

Fixed `timeTravel()` into a `.branch()` step on evented workflows leaking an empty result for the branches that were not selected. The aggregated branch output now only includes the branch that ran, matching the default workflow engine.
