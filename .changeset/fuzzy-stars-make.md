---
'@mastra/core': patch
---

Improved typing for `workflow.then` to allow the provided steps `inputSchema` to be a subset of the previous steps `outputSchema`. Also errors if the provided steps `inputSchema` is a superset of the previous steps outputSchema.
