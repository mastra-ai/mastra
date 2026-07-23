---
'@mastra/client-js': patch
---

Added typed dataset item `timeout` overrides and the experiment trigger `itemTimeout` fallback. For example, call `client.addDatasetItem({ datasetId, input, timeout: 5_000 })` and `client.triggerDatasetExperiment({ datasetId, targetType: "agent", targetId: "agent", itemTimeout: 30_000 })`.
