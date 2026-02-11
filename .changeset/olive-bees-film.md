---
'@mastra/core': patch
---

Added modelId to assistant message content.metadata from response-metadata stream chunks. Downstream consumers (storage adapters, processors) can now read which model generated each assistant message via content.metadata.modelId.
