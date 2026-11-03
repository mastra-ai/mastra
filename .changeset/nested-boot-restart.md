---
'@mastra/core': patch
---

Fixed `mastra.restartAllActiveWorkflowRuns()` running a nested workflow twice at once. When a workflow and a nested workflow it runs were both registered, the nested run was restarted on its own and again by its parent. It is now restarted only through its parent.
