---
'mastra': patch
---

Fixed the workflow graph so clicking "View nested graph" on a step opens the nested workflow view again in Studio. Selecting a nested step now reveals the nested flow in a side panel, and "Hide nested graph" closes it.

Also fixed conditional branch coloring in the workflow graph: when a conditional selects one arm, edges into the un-taken arm now stay neutral instead of incorrectly turning green.
