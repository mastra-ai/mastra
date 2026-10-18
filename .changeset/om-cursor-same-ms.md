---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/mongodb': patch
---

Fixed Observational Memory occasionally hiding a message from the agent before it was observed. When background observation finished, a message that arrived 1ms later could be treated as already observed, so it was dropped from context and never observed, even after the background observation became active. Background observations now record the exact time of their newest message, so the next message stays visible. Observations saved by earlier versions are still recognized.
