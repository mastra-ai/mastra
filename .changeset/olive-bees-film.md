---
'@mastra/core': patch
---

Fixed `modelId` not being persisted in assistant message `content.metadata`. Downstream consumers (storage adapters, processors) can now read which model generated each assistant message via `content.metadata.modelId`.

