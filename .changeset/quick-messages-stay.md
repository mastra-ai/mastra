---
'@mastra/clickhouse': patch
---

Fixed `updateMessages` deleting and re-inserting every message whose content it updated. Content updates are now applied in place, which is faster and no longer logs the full message content.
