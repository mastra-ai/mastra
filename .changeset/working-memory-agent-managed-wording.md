---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed agents saying they can't save information when working memory uses `agentManaged: false`. The app still updates working memory in that mode, so the instructions now tell the agent that memory is updated automatically after each response and that it should acknowledge new information instead of claiming it can't save it. The "read-only, you cannot update it" wording is now used only when `readOnly: true` is set.
