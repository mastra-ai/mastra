---
'mastracode': minor
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Approving a plan now starts it as a goal. The plan approval prompt offers only **Approve** and **Request changes**; the separate **Use as /goal** option is gone. When no goal judge model is configured, the current model judges the plan goal instead of prompting for one.

Hosts where plan approval does not start a goal can pass `planApprovalStartsGoal: false` to `createMastraCode`, so the agent prompt no longer tells the model that approval starts a goal. Factory sessions use this, and their Approve option says it switches to Build mode and implements.
