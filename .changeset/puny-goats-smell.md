---
'@mastra/core': patch
---

Fixed resume errors for suspended agent runs: `resumeStream()` and `resumeGenerate()` now return a clear message when storage is missing or the `runId` is invalid.
