---
'@mastra/pg': patch
'@mastra/dsql': patch
---

Await asynchronous rollback diagnostics so reporter failures cannot escape transaction cleanup or mask the original transaction error.
