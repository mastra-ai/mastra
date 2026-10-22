---
'@mastra/memory': patch
---

Fixed repeated embedding of unchanged observation groups during synchronous observation retrieval, including after a `Memory` restart. Only new or changed groups need new embeddings. Failed index writes are retried on the next cycle. Index entries stay linked to the current observation record. Fixes https://github.com/mastra-ai/mastra/issues/27930.
