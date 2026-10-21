---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed Gemini 3 agents with working memory failing with "Function call is missing a thought_signature" when continuing a turn (for example after a client tool result). Gemini signs only the first tool call in a parallel step; when that call was `updateWorkingMemory`, removing it from saved history left the step without a signed first call. The next tool call in the step is now saved with Google's documented `skip_thought_signature_validator` signature, so the step replays on any Gemini client.
