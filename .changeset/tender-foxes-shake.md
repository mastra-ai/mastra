---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed Knowledge mutations accepting nonexistent import runs, ensuring failed run-linked writes leave stored data unchanged.
