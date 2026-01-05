---
'@mastra/pg': patch
---

Fix thread timestamps being returned in incorrect timezone from listThreadsByResourceId

The method was not using the timezone-aware columns (createdAtZ/updatedAtZ), causing timestamps to be interpreted in local timezone instead of UTC. Now correctly uses TIMESTAMPTZ columns with fallback for legacy data.
