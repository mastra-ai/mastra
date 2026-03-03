---
'@mastra/core': patch
---

Added `modelId` to assistant message `content.metadata` at message construction time during streaming. Each message carries the model identifier when added to the message list, ensuring sealed/split messages from observational memory retain their `modelId`. Downstream consumers (storage adapters, processors) can read which model generated each assistant message via `content.metadata.modelId`.
