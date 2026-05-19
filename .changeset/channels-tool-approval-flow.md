---
'@mastra/core': patch
---

Fix tool approval flow in `AgentChannels` so the resumed run actually renders to the chat platform:

- On Approve, the resumed `MastraModelOutput` stream is now drained so the run progresses. Chunks fan into the existing thread subscription, which edits the approval card with the tool result and posts any follow-up assistant text.
- On Deny, the agent run is now resumed via `declineToolCall` so the model can produce a follow-up message acknowledging the denial. Previously the card was edited to "Denied" but the suspended run was left running forever with no feedback from the agent.
