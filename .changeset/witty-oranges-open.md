---
'@mastra/core': patch
---

Fixed TypeScript type errors when using .optional().default() in workflow input schemas. Workflows with default values in their schemas no longer produce false type errors when chaining steps with .then(). Fixes #12634
