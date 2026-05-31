---
'@mastra/core': patch
---

Improved multi-branch suspend/resume support in dataset experiments: all suspended branches are now resumed sequentially (previously only the first was resumed). Tightened type safety by replacing `any` with a `WorkflowResultLike` interface in the executor. Added documentation for `requestContext` and resume data fields in experiment configuration.
