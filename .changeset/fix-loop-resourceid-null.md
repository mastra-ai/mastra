---
'@mastra/core': patch
---

Fixed resourceId being overwritten to NULL during workflow execution of loop, foreach, parallel, and conditional steps. The resourceId set via `createRun()` is now correctly preserved throughout the entire workflow lifecycle.
