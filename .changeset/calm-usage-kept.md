---
'@mastra/core': patch
---

Fixed token usage being reported as `undefined` in `onFinish` when a structured-output run fails schema validation. The model's final chunk, which carries the usage, is now still read after the validation error.
