---
'@mastra/core': patch
---

Fixed TypeScript type generation hanging or running out of memory when packages depend on @mastra/core tool types. Changed ZodLikeSchema from a nominal union type to structural typing, which prevents TypeScript from performing deep comparisons of zod v3/v4 type trees during generic inference.
