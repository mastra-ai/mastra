---
'@mastra/dynamodb': minor
---

Add `lastMessageAt` attribute to thread entities. The field advances on `saveMessages` and recomputes on `deleteMessages`, with null-safe sort handling.
