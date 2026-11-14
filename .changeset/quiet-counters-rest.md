---
'@mastra/memory': patch
---

Observational Memory does half as much work per step in long tool runs. Token counting no longer serializes every plain JSON tool result a second time just to check it for images, so each step serializes the earlier tool results twice instead of four times. Token counts are unchanged.
