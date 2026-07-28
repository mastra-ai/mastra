---
'@mastra/pg': patch
---

Fixed PostgreSQL factory locks so concurrent callbacks no longer exhaust connections or crash on dropped clients.
