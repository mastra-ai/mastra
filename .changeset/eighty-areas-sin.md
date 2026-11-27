---
'@mastra/evals': patch
---

Fixed trajectory scorers scoring a correct tool call as wrong when its arguments had the same values but the keys came in a different order. A repeated tool call whose arguments differ only in key order is now reported as redundant.
