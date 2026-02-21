---
'@mastra/lance': minor
---

Add `lastMessageAt` field to thread records. The field advances on `saveMessages` and recomputes on `deleteMessages`, with null-safe sort handling.
