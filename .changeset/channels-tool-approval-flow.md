---
'@mastra/core': patch
---

Fix tool approval flow in `AgentChannels` so the resumed agent run actually renders to the chat platform on Approve and Deny:

- Approve: drain the resumed `MastraModelOutput` stream and fan its chunks to the existing thread subscription, so the approval card is updated with the tool result and any follow-up assistant text is posted.
- Deny: resume the agent run via `declineToolCall` so the model can acknowledge the denial. Previously the card was edited to "Denied" but the suspended run was left running with no follow-up.
- `agent.subscribeToThread()` consumers now receive chunks from resumed runs. The subscription used to deduplicate by run id, which silently dropped the second registration for a resumed run that kept its original `runId`.
