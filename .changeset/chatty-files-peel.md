---
'@mastra/core': patch
---

Removed system prompt with todays date since it can interfere with input token caching. Also removed a memory system prompt that refered to date ranges - we no longer use date ranges for memory so this was removed
