---
'@mastra/core': patch
'@mastra/inngest': patch
---

Resume labels of steps suspended inside a nested workflow now carry a `path` field pointing at the suspended step, e.g. `{ stepId: 'review', path: ['review', 'approve-b'] }`. Resuming with a label's `path` now resumes exactly that step; previously the label named only the nested workflow, so resuming by its `stepId` failed the whole run when two of the workflow's steps were suspended. `stepId` is unchanged. Resuming by a nested workflow's step ID while it has several suspended steps now throws a `WORKFLOW_RESUME_AMBIGUOUS_NESTED_STEP` error before execution and leaves the run suspended, instead of failing it. Fixes [#29782](https://github.com/mastra-ai/mastra/issues/29782).