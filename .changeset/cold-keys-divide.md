---
'@mastra/mongodb': patch
---

Fixed `MongoDBVector.createIndex()` leaving the companion full-text search index missing when the vector index already existed. Each of the two Atlas Search index creations now treats IndexAlreadyExists independently, so an interrupted or repeated `createIndex` call completes the remaining index instead of skipping it.
