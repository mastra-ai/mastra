---
'@mastra/memory': patch
---

Fix connection pool exhaustion when saving many messages with semantic recall enabled. Instead of calling vector.upsert() for each message individually (which acquires a separate DB connection), all embeddings are now batched into a single upsert call.
