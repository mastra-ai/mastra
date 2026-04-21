---
'@mastra/core': patch
---

Fixed multi-step agent responses returning empty uiMessages when savePerStep is enabled. Tool call results and intermediate step outputs were being lost because the message tracking set was cleared after each step's persistence flush. The final response now reads from the persisted message set which accumulates across all steps.
