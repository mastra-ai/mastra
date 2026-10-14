---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/mongodb': patch
---

Fixed Observational Memory occasionally hiding a message from the agent before it was observed. A message arriving 1ms after an async-buffered chunk could be treated as already observed, so it was pruned from context and never sent to the Observer, including after the chunk was activated. Buffered chunks now record the exact time of their newest message, so every cursor check keeps that next message. Chunks written by earlier versions are still recognized.
