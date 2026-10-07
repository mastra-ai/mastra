---
'@mastra/core': patch
'@mastra/server': patch
---

AgentController sessions now forward the agent's `isTaskComplete` verdict as a live `task_complete_evaluation` event, so web clients can show "the check failed, the agent is fixing it" right away.

The session stream also sends the current display state, including the message being streamed, as its first event. A page that opens or reloads mid-run now sees the in-flight assistant text instead of waiting until it is stored.
