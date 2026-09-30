---
'@mastra/pg': patch
---

Fixed Postgres skill updates not advancing `updatedAt` when the update only re-sends unchanged skill content. Postgres now bumps `updatedAt` on every update, matching the in-memory and LibSQL stores, so PATCH responses and `updatedAt`-sorted skill lists stay consistent across stores.
