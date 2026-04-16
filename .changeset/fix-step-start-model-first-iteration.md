---
'@mastra/core': patch
---

Stamp `step-start.model` on the first iteration of a loop run

The `enrichLastStepStart` call was gated behind `currentIteration > 1`, so the initial assistant message persisted without the resolved `provider/modelId` on its `step-start` part. Downstream consumers that read `step-start.model` (for example, observational memory's provider-change detector) fell back to the bare `modelId` from `content.metadata`, which could produce spurious mismatches against a fully-qualified `provider/modelId` on later turns.

Removing the gate stamps the first-iteration `step-start` in the same shape as subsequent iterations.
