---
'@mastra/mongodb': patch
---

Implemented `updateNotificationsStatus` with a single `updateMany` so marking many notifications seen no longer issues one write per record.
