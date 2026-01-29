---
'@mastra/core': patch
---

Fixed skill loading error caused by Zod version conflicts between v3 and v4. Replaced Zod schemas with plain TypeScript validation functions in skill metadata validation.
