---
'@mastra/inngest': patch
---

Fixed InngestAgent losing durable execution in two cases (#24736).

- **Editor overrides**: `__fork()` now returns an Inngest-backed agent, so agents with published editor overrides keep running on Inngest instead of silently running in-process.
- **Resuming suspended runs**: `resumeStream()`, `approveToolCall()`, `declineToolCall()`, `approveToolCallGenerate()` and `declineToolCallGenerate()` now resume the suspended Inngest run. Previously they threw `AGENT_RESUME_NO_SNAPSHOT_FOUND`, which broke `chatRoute` tool approval.
