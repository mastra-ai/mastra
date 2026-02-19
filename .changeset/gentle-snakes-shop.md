---
'@mastra/core': patch
---

Fixed tsc out-of-memory crash caused by step-schema.d.ts expanding to 50k lines. Added explicit type annotations to all exported Zod schema constants, reducing declaration output from 49,729 to ~500 lines without changing runtime behavior.
