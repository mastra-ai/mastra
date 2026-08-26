---
'@mastra/core': patch
'mastra': patch
---

Start the scheduler as part of the default worker set so schedules created after worker startup are discovered without a restart.
