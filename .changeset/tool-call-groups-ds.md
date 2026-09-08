---
'@mastra/playground-ui': patch
---

Add `groupConsecutive`, `TOOL_GROUP_MIN` and `isTaskTool` to `components/ai/tool-call`, so every chat folds runs of consecutive tool calls with the same rule and hides the same docked task tools.
