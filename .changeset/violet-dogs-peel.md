---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed an issue where some user messages and llm messages would have the exact same createdAt date, leading to incorrect message ordering. Added a fix for new messages as well as any that were saved before the fix in the wrong order
