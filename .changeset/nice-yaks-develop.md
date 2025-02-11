---
'@mastra/core': patch
---

Fixed libsql db relative file paths so they're always outside the .mastra directory. If they're inside .mastra they will be deleted when code is re-bundled
