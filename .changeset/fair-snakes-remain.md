---
'@mastra/core': patch
---

When LLMs like Claude Sonnet 4.5 and Gemini 2.4 call tools with all-optional parameters, they send `args: undefined` instead of `args: {}`. This caused validation to fail with "root: Required".

The fix normalizes `undefined`/`null` to `{}` for object schemas and `[]` for array schemas before validation.
