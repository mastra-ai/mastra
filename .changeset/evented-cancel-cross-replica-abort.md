---
'@mastra/core': patch
---

Fixed cancelling an evented workflow run with workers on several replicas. Previously only the replica that received `workflow.cancel` aborted its steps, so a step running on another replica never saw its `abortSignal` fire and kept running. Cancelling now reaches every replica running a step of the run, including steps of nested workflows.
