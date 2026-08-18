---
'@mastra/core': patch
---

Sub-agent delegation no longer attempts to resume when the model supplies `resumeData` without a suspended run. Previously the delegation step chose the resume path on `resumeData` alone and called `resumeGenerate`/`resumeStream` with an undefined run id, throwing `AGENT_RESUME_NO_SNAPSHOT_FOUND` before the sub-agent executed. It now starts a fresh delegation in that case.
