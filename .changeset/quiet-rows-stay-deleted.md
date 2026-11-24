---
'@mastra/memory': patch
---

Fixed Observational Memory bringing back a message you deleted. When a message that already carried a completed observation boundary was resaved after its row had been removed from storage, the save re-created the row. Resaves of such messages now skip rows that no longer exist, so deleted messages stay deleted.
