---
'@mastra/core': patch
---

Fixed tool approvals so they always go to the run that requested them. Approving a tool call after a newer run has started on the thread no longer resumes the wrong run.

`agent.sendToolApproval({ threadId, resourceId, runId, approved })` resumes exactly the run you name, including after a server restart. If that run has already ended, the call throws instead of resuming a different suspended run on the thread.
