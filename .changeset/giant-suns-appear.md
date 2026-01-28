---
'@mastra/core': patch
---

Fixed TypeScript error when using bail() inside createStep execute functions. The bail() utility now accepts any value type, not just the step's output schema type. This allows bail() to be used to exit a workflow early with a result that doesn't match the step's outputSchema, which is the intended behavior since bail() terminates the entire workflow. Fixes #12424.
