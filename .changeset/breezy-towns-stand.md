---
'@mastra/mongodb': minor
---

Add `lastMessageAt` field to thread documents. The field advances on `saveMessages` using MongoDB's `$max` operator and recomputes on `deleteMessages`.
