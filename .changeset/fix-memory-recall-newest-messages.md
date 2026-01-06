---
'@mastra/memory': patch
---

When using lastMessages: N config without an explicit orderBy, the recall() function was returning the OLDEST N messages instead of the NEWEST N messages. This completely breaks conversation history for any thread that grows beyond the lastMessages limit.
