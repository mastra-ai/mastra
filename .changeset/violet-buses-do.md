---
'@mastra/core': minor
---

Added per-item experiment timeout overrides. Set `timeout` on an inline or persisted dataset item, and use `itemTimeout` when starting an experiment as the fallback for items without an override: `dataset.addItem({ input, timeout: 5_000 })` and `dataset.startExperiment({ targetType: "agent", targetId: "agent", itemTimeout: 30_000 })`. The effective timeout is one budget across execution, retry backoff, and retries.
