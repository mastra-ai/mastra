---
'@mastra/libsql': patch
---

Fixed Factory database lock errors by serializing writes that share a LibSQL connection.
