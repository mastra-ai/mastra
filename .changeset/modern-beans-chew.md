---
'@mastra/pg': minor
---

Add `lastMessageAt` column to threads table with migration backfill for existing threads. The field advances on `saveMessages` and recomputes on `deleteMessages`.
