---
'@mastra/spanner': patch
---

Fixed `listMessages()` on Spanner always failing with a SQL syntax error, which kept memory from loading message history.
