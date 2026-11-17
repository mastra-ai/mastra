---
'@mastra/memory': patch
---

Improved token counting in long Observational Memory tool runs by removing redundant serialization of plain JSON tool results. Token counting no longer serializes every plain JSON tool result a second time just to check it for images, so each step serializes the earlier tool results twice instead of four times. Token counts are unchanged.
