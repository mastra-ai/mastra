---
'@mastra/mongodb': minor
---

Added Automated Embedding support to `MongoDBVector`. Create an index with `autoEmbed` and a Voyage AI model such as `voyage-4`, then write plain text through `documents` and search with `queryText`. MongoDB generates the embeddings server-side, so your application needs no embedding provider, no model wiring, and no dimension bookkeeping.

`hybridQuery` accepts `queryText` for its vector branch, and both query methods take an optional `model` to override the index's model for a single search. Indexes that supply their own vectors keep working exactly as before.

Automated Embedding is a MongoDB Preview feature. It requires an Atlas cluster with Automated Embedding enabled, or the `mongodb/mongodb-atlas-local:preview` image locally.
