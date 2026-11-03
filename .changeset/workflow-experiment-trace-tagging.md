---
'@mastra/core': patch
---

Fixed dataset experiments that target a workflow so their traces carry the experiment ID. Workflow runs and every auto-resume now include `experimentId` in tracing metadata, so Studio's experiment page shows total cost, tokens and run duration for workflow experiments, the same as it does for agent experiments.
