---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

AgentController sessions now forward the agent's `isTaskComplete` verdict as a live `task_complete_evaluation` event, so web clients can show "the check failed, the agent is fixing it" right away. `@mastra/client-js` recognizes the new event type.

The session stream also sends the current display state, including the message being streamed, as its first event. A page that opens or reloads mid-run now sees the in-flight assistant text instead of waiting until it is stored. `currentMessage` can hold a message that is already stored (for example between steps or after a run), so clients should merge it by message id rather than append it.
