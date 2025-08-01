---
'@mastra/core': patch
'@mastra/mcp': patch
---

Tool input validation now returns errors as tool results instead of throwing, allowing agents to understand validation failures and retry with corrected parameters.
