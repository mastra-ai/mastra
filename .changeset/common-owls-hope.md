---
'@mastra/memory': patch
---

Fixed Observational Memory dropping recent messages one step after a buffered activation. When `bufferActivation` keeps some already-observed messages in the prompt so the agent still sees recent raw context, those messages now stay for the rest of the turn until a newer observation covers them, instead of being removed on the very next model call. Fixes #30079.
