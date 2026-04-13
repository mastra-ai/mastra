---
'@mastra/editor': patch
---

Fixed agent version resolution to no longer mutate the singleton agent instance. `applyStoredOverrides` now forks the agent before applying overrides, making concurrent versioned agent resolution safe.
