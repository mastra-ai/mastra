---
'@mastra/core': patch
---

Fixed authorization checks in agent resume methods. When fine-grained access control is enabled, `resumeStream()`, `resumeStreamUntilIdle()`, and `resumeGenerate()` now require an authenticated user in the request context and will throw an error if called without one.
