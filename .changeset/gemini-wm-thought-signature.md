---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed Gemini 3 agents with working memory failing with "Function call is missing a thought_signature" when continuing a turn (for example after a client tool result). Gemini signs only the first tool call in a parallel step; when that call was `updateWorkingMemory`, removing it from saved history also removed the signature. The signature now moves to the next tool call in the same step.
