---
'@mastra/memory': patch
---

Fixed Observational Memory bringing back a message you deleted. When a message that already carried a completed observation boundary was resaved after its row had been removed from storage, the save re-created the row. Resaves of such messages now skip rows that no longer exist, so deleted messages stay deleted. The check reads the stored row just before saving, so a message deleted in the instant between that check and the save can still be re-created.
