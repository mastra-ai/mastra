---
'@mastra/pg': patch
'@mastra/libsql': patch
---

Look up the scheduler's next fire time with a single indexed query instead of loading every active schedule.
