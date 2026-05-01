---
'@mastra/mongodb': patch
---

Removed unsupported `minScore` query option from MongoDB vector store docs and README. Exported `MongoDBQueryVectorParams` so callers can type `documentFilter` for `MongoDBVector.query()`.

Fixes #15715
