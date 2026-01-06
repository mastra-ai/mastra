---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed client-side tool invocations not being stored in memory. Previously, tool invocations with state 'call' were filtered out before persistence, which incorrectly removed client-side tools. Now only streaming intermediate states ('partial-call') are filtered.

Fixed a crash when updating working memory with an empty or null update; existing data is now preserved.
