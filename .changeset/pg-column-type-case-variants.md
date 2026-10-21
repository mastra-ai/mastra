---
'@mastra/pg': patch
---

Fix column existence and type checks throwing "Multiple rows returned" when a table has two columns whose names differ only by case (for example `"resourceId"` and `resourceid`). The exact-case column is now preferred, with the lowercase name as a fallback.
