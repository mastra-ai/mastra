---
'@mastra/server': patch
---

Avoid starting a second agent run when concurrent A2A streaming follow-ups target the same suspended task. Followers wait for the claimed resume and receive its final task state, matching the non-streaming handler.
