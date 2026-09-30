---
'@mastra/pg': patch
---

Fixed Postgres workspace updates not advancing `updatedAt` when the update only re-sends unchanged workspace configuration. Postgres now bumps `updatedAt` on every update, matching the in-memory and LibSQL stores.
