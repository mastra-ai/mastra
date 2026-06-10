---
'@mastra/playground-ui': patch
---

Fixed the Evaluate Trace button in Studio (Agents → Traces) doing nothing on the first click. Selecting the anchor span and opening the scoring tab now happen in a single URL update instead of two racing ones, so the scoring panel opens immediately.
