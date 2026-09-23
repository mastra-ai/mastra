---
'@mastra/core': patch
---

Fixed tool approvals so they always go to the run that requested them.

- `AgentController` now passes the requesting run, thread and resource with every approval. Before, an approval handled after the session moved on to a newer run could resume the wrong run.
- `agent.sendToolApproval({ threadId, resourceId, runId, approved })` resumes exactly the run you name, including after a server restart. If that run has already ended, the call throws instead of resuming a different suspended run on the thread.
