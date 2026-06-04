---
'@mastra/core': patch
---

Fix `Cannot get workflow run. Mastra storage is not initialized` debug log spam on agents that use memory or any input/output processors.

#17344 fixed this for the internal `execution-workflow`, but agents with memory/processors also build an internal *processor* workflow (`Agent.combineProcessorsIntoWorkflow`, run by `ProcessorRunner.executeWorkflowAsProcessor`) that never received the parent `Mastra` instance — so its `createRun()` → `getWorkflowRunById()` saw no storage and logged the noise on every run. The processor workflow now receives the parent `Mastra` instance and opts out of snapshot persistence (`shouldPersistSnapshot: () => false`), mirroring the execution-workflow fix. Follow-up to #17137 / #17344.
