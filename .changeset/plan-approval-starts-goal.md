---
'mastracode': minor
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Approving a plan now starts it as a goal. The plan approval prompt offers only **Approve** and **Request changes**; the separate **Use as /goal** option is gone. When no goal judge model is configured, the current model judges the plan goal instead of prompting for one.
