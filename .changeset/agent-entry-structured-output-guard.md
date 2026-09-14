---
'@mastra/core': patch
---

A workflow `.agent()` step that declares `structuredOutput.schema` now fails when the agent finishes without producing an object, instead of silently reporting `success` and returning `{ text }`. The step throws a `MastraError` (`STRUCTURED_OUTPUT_OBJECT_UNDEFINED`) carrying the `finishReason`, matching how the rest of the agent stack guards missing structured output. A validly-parsed falsy object (e.g. `0`) is still treated as produced, and steps without a declared schema are unaffected. Fixes #23403.
