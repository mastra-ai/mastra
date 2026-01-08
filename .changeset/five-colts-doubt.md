---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'create-mastra': patch
---

Add human-in-the-loop (HITL) support to agent networks

- Add suspend/resume capabilities to agent network
- Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

`agent.resumeNetwork`, `agent.approveNetworkTooCall`, `agent.declineNetworkToolCall`
