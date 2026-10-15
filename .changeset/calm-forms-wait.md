---
'@mastra/core': patch
---

Fixed `resumeGenerate()` and `resumeStream()` using up a suspended run when the resume data does not match the tool's `resumeSchema`. They now throw `AGENT_RESUME_INVALID_DATA` and the run stays suspended, so you can resume again with valid data.
