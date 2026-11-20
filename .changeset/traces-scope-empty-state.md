---
'@mastra/playground-ui': patch
---

A Traces explorer scoped to one entity, such as an agent's Traces tab, now shows its empty state when that entity has no runs. Before, it showed "No traces found for applied filters" because the hidden scope counted as an applied filter.
