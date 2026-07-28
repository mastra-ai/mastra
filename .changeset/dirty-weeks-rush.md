---
'@mastra/playground-ui': patch
---

Fixed Sankey chart labels overlapping between neighbouring columns on narrow charts. Node names and column headers are now measured against the space each column actually has, and a label that no longer fits is clipped with an ellipsis. Hovering a clipped label still shows its full text.
