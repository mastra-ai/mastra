---
'@mastra/mongodb': minor
---

Add configurable embeddingFieldPath option to MongoDBVector constructor. This allows users to specify custom paths for storing vector embeddings, including nested document paths using dot notation (e.g., text.contentEmbedding). Defaults to 'embedding' for backward compatibility.
