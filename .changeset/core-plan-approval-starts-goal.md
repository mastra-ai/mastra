---
'@mastra/core': patch
---

The coding-agent base prompt now says that approving a submitted plan starts it as a goal. Set `planApprovalStartsGoal: false` in the prompt context to say approval switches to Build mode without starting a goal and to leave out the `/goal` command.
