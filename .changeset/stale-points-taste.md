---
'@mastra/libsql': patch
---

Fixed `truncateIndex` on LibSQL vector stores leaving the vector index broken, so later inserts failed with "failed to insert shadow row".
