---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Fixed Sankey chart node percentages so each node shows its share of its own column instead of the first column's total. Outcome and sentiment nodes no longer display values above 100%.
