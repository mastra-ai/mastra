---
'@mastra/react': patch
---

Fixed Studio treating a generic runtime `context.agent.suspend()` as a pending tool approval. Generic suspensions no longer flip the chat into an "awaiting approval" state (on live streams or on reload), so you can send a follow-up message that automatically resumes the suspended tool. `Tool.requireApproval` still shows approve/decline as before.
