---
'@mastra/core': patch
'@mastra/slack': patch
---

Channels now serialize messages per thread to keep conversations in order, and several adjacent bugs are fixed:

- Messages arriving while the agent is busy are delivered into the running agent loop instead of starting a new, conflicting stream on the same thread. Each Mastra thread shares one subscription, and channel/author facts (platform, message id, author name) are surfaced on the stored message under `providerMetadata.mastra.channels.<platform>`. New `AgentChannels.close()` tears down all live thread subscriptions.
- Tool approval flow: approving now drains the resumed run so the card is updated with the tool result and any follow-up assistant text is posted. Denying now resumes the run via `declineToolCall` instead of leaving it suspended. `agent.subscribeToThread()` consumers also receive chunks from resumed runs (the subscription used to drop the second registration for a resumed run that kept its original `runId`).
- `SlackProvider.connect()` now merges with existing channel adapters instead of replacing them, preserving adapters the agent author already configured (e.g. Discord). The original `ChannelConfig` is exposed via the new `AgentChannels.channelConfig` field.
- Slack interactive payloads (button clicks, modal submissions) no longer return `400 Malformed JSON body`. The provider only JSON-parses the body for the events callback path and forwards form-urlencoded payloads to the adapter's webhook handler unchanged.
- Bumped `chat` to `^4.29.0`.
