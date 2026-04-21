---
'@mastra/core': patch
---

Fixed `dataset.startExperiment` hanging forever when `targetType` is `'workflow'`. Workflow experiments now complete normally, honour `itemTimeout`, and surface failures. Fixes #15453.
