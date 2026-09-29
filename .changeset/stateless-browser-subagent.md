---
'@mastra/core': patch
---

Fixed subagents without memory failing immediately when their workspace has a browser. These subagents now complete their tasks and still see browser context in their prompt.
