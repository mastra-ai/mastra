---
'@mastra/core': patch
---

`resumeGenerate()` and `resumeStream()` now reject resume data that does not match the suspended tool's `resumeSchema`, and the run stays suspended. Previously the run carried on with a validation error and was deleted, so a corrected `resumeGenerate()` call failed with `AGENT_RESUME_NO_SNAPSHOT_FOUND`. The new error has the id `AGENT_RESUME_INVALID_DATA`, so you can catch it and resume again with valid data.
