---
'@mastra/core': patch
---

Fixed dataset experiments that target a workflow so their traces carry the experiment ID. Workflow runs and every auto-resume now include `experimentId` in tracing metadata, for both standard and evented workflows (`createEventedWorkflow`). Studio's experiment page now shows total cost and tokens for workflow experiments, the same as it does for agent experiments. Fixes [#29232](https://github.com/mastra-ai/mastra/issues/29232).

Evented workflow runs now also return `traceId` and `spanId` from `run.start()` and `run.resume()`, like standard workflows already do. Studio uses these to show each experiment item's cost, tokens and trace link.
