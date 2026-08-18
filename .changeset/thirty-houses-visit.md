---
'@mastra/core': patch
---

Fixed DurableAgent snapshots to prune duplicated foreach suspension data so long-running agents do not exceed storage document limits.
