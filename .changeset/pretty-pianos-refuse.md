---
'@mastra/playground-ui': patch
---

Fixed several Sankey chart rendering defects: node percentages now show each node's share of its own column instead of the first column's total (no more values above 100%), ribbons are anchored to their own column pair so partially linked flows no longer stretch across the full chart, hovering a node shows a single tooltip instead of a duplicate native title popup, and hovering a column header no longer pops the top theme's tooltip.
