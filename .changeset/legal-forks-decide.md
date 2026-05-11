---
'@mastra/core': patch
---

Fixed `timeTravel()` on evented workflows so jumping to a `.branch()` step no longer returns empty results for branches that did not run. Branch results now include only the branch that ran, matching the default workflow engine.
