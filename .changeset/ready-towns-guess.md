---
'@mastra/core': patch
---

Fixed runEvals TypeScript overloads for Workflow targets so they accept gates and threshold-bearing scorer entries, matching what the runtime already supports. Workflow eval runs can now produce a verdict without type errors. Fixes #21290
