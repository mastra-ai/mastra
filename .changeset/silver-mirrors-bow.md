---
'@mastra/ai-sdk': patch
---

Fixed streaming for agents nested three or more levels deep. Progress from a sub-agent's sub-agent now reaches the client while it happens, instead of appearing only after the whole chain finishes.
