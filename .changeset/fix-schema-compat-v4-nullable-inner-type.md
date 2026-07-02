---
'@mastra/schema-compat': patch
---

Fix the Zod v4 nullable and optional handlers gating on the wrapper type instead of the wrapped inner type. They checked `value.constructor.name` (always `"ZodNullable"`/`"ZodOptional"`), so the inner type was always processed. A nullable/optional wrapping an unsupported inner type (such as a tuple) is now passed through unchanged, matching the v3 handler, instead of being processed and rejected. Closes #18687.
