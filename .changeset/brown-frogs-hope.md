---
'@mastra/pg': patch
---

Fix missing timezone columns during PostgreSQL spans table migration

Fixes issue #11410 where users upgrading to observability beta.7 encountered errors about missing `startedAtZ`, `endedAtZ`, `createdAtZ`, and `updatedAtZ` columns. The migration now properly adds timezone-aware columns for all timestamp fields when upgrading existing databases, ensuring compatibility with the new observability implementation that requires these columns for batch operations.
