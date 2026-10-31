---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

Fixed notification summaries being sent twice when two dispatch passes overlap. Claiming a due summary is now a single conditional update, so only one pass can claim it.
