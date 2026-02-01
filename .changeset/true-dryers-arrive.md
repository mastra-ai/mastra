---
'@mastra/core': patch
---

Fixed createTool to accept Zod schemas with .transform() on outputSchema without requiring `as any`. The execute function now correctly expects the pre-transform (input) type, while validation still applies the transform before returning the post-transform result to callers.
