---
'@mastra/mongodb': patch
---

Fixed `MongoDBVector.createIndex()` leaving index setup incomplete. Previously, when the vector search index already existed, the call silently skipped creating the companion full-text search index. Repeated or interrupted `createIndex()` calls now finish creating the remaining search index instead of leaving setup incomplete.
