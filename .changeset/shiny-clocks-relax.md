---
'@mastra/server': patch
---

Fixed server handler bugs: filter parsing now handles colons in values (timestamps, URLs), dateRange validation now converts JSON strings to Date objects, deleteMessages schema accepts object forms, and added missing responseSchema for legacy stream route
