---
'@mastra/memory': patch
---

Observational Memory does much less work per step in long tool runs. Token counting no longer serializes every plain JSON tool result a second time just to check for images, and a step where nothing was observed or buffered no longer recounts the whole context a second time. In a 100-step tool run, each step now serializes the earlier tool results once instead of four times. Token counts are unchanged.
