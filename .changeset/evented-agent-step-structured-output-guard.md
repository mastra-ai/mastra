---
'@mastra/core': patch
---

`createStep(agent)` from `@mastra/core/workflows/evented` now fails when a declared `structuredOutput.schema` produces no object, instead of silently reporting `success` and returning `{ text }`. The step throws a `MastraError` (`STRUCTURED_OUTPUT_OBJECT_UNDEFINED`) carrying `finishReason` and `usage`, matching the existing `.agent()` guard. A validly-parsed falsy object (e.g. `0`) is still treated as produced. Fixes #23403.
