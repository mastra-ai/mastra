---
'@mastra/core': patch
---

Fixed durable runs reporting success after a message save or output processor fails. Failed finalization reports an error and retains a suspended workflow snapshot. Resume the same run to retry finalization without repeating completed model or tool steps.
