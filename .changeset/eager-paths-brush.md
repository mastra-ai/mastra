---
'@mastra/mongodb': patch
---

Fixed new observability span writes in MongoDB so `startedAt`, `endedAt`, `createdAt`, and `updatedAt` are stored as native BSON Date objects. Existing string-typed span dates remain readable and date filters support both old string values and new Date values.
