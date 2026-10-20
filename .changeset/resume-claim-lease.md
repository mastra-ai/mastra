---
'@mastra/core': patch
---

Fixed suspended agent runs staying blocked forever when the process resuming them dies. Before, if a process crashed while running `resumeGenerate()`, `resumeStream()` or a tool approval, every later resume of that run failed with `AGENT_RESUME_ALREADY_CLAIMED`. Now a running resume keeps renewing its claim, and once the claim has gone 60 seconds without a renewal, a later resume takes the run over and resumes it from the suspended tool call. While the first resume is still alive, other resumes are rejected as before.

Fixes #27366.
