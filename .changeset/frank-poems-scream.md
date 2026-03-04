---
'@mastra/core': patch
---

Fixed `generate()` and `resumeGenerate()` to always throw provider stream errors. Previously, certain provider errors were silently swallowed, returning false "successful" empty responses. Now errors are always surfaced to the caller, making retry logic reliable when providers fail transiently.
