---
'@mastra/core': patch
---

Fixed an issue where supervisor agent messages were being saved to the sub-agent thread, causing duplicate tool call badges to appear in the chat history when sub-agents are invoked multiple times.
