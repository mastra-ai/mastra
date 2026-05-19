---
'@mastra/core': patch
---

Channels now serialize messages per thread to keep conversations in order, and the tool approval flow is fixed end-to-end:

- Messages arriving while the agent is busy are delivered into the running agent loop instead of starting a new, conflicting stream on the same thread. Each Mastra thread shares one subscription, and channel/author facts (platform, message id, author name) are surfaced on the stored message under `providerMetadata.mastra.channels.<platform>`.
- Tool approval flow: approving now drains the resumed run so the card is updated with the tool result and any follow-up assistant text is posted. Denying now resumes the run via `declineToolCall` instead of leaving it suspended. `agent.subscribeToThread()` consumers also receive chunks from resumed runs (the subscription used to drop the second registration for a resumed run that kept its original `runId`).
- The original `ChannelConfig` is now exposed via the new `AgentChannels.channelConfig` field so channel providers can merge with existing adapters instead of replacing them.
- Bumped `chat` to `^4.29.0`.
