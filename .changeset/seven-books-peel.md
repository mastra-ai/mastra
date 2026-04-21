---
'@mastra/core': patch
---

Fixed `dataset.startExperiment({ targetType: 'workflow', targetId })` hanging forever. Internally, the target resolver returned a workflow from an async function, but workflows expose a `.then(step)` builder method that makes them look like a thenable to JavaScript. The promise machinery then tried to unwrap the workflow and never settled. The resolver now returns a non-thenable wrapper so workflow experiments complete normally, honour `itemTimeout`, and surface failures. Fixes #15453.
