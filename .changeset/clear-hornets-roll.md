---
'@mastra/pg': patch
---

Fixed distributed locks so long-running critical sections no longer keep PostgreSQL transactions open.
