---
'@mastra/code-sdk': patch
---

Goals are now graded even when no goal judge model is configured. The judge is the configured judge setting, then the goal's own `judgeModelId`, then the session's model.
