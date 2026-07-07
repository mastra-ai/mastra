---
'@mastra/core': patch
---

Fixed a heap out-of-memory crash at startup when using mapVariable to map init data (or a workflow-typed step) into a step. The serialized workflow graph now stores a reference to the workflow by id instead of inlining the entire live workflow instance (including its logger and nested steps), which could balloon to ~1GB and crash the process during workflow setup. (#19018)
