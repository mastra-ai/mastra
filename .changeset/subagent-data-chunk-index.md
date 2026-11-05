---
'@mastra/core': patch
---

`data-*` chunks that a durable sub-agent writes no longer carry the sub-agent's run-log `index` onto a plain parent agent's stream, where it could be mistaken for a resume position in the parent run.
