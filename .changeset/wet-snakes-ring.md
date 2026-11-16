---
'@mastra/server': patch
---

Workflow steps run by a standalone worker through the step-execution endpoint now follow the run's experimental `storageVersion`, so a version 2 run reads step results and state the same way remotely as in-process.
