---
'@mastra/playground-ui': patch
---

Fixed Sankey chart node and column labels overlapping between adjacent columns by truncating labels that are wider than the available per-column space with an ellipsis, exposing the full text via a hover `title`.
