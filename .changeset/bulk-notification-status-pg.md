---
'@mastra/pg': patch
---

Implemented `updateNotificationsStatus` as a single `UPDATE … RETURNING` so marking many notifications seen no longer issues one write per record.
