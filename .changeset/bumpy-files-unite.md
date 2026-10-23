---
'@mastra/core': patch
---

Fixed channel agents losing their channel instructions on runs that didn't start from a chat message, such as a schedule, a Studio prompt or a signal.

- Every run on a channel-backed thread now gets the same channel system prompt, so switching between chat messages and other runs keeps the prompt cached. Replies from those runs stream to the channel the same way.
- The prompt's opening line changed from "You are communicating via slack." to "This conversation is connected to a slack thread." (or "slack direct message"). This applies to every channel agent.
- Messages that come in over a channel now carry a `platform` attribute, for example `platform="slack"`.
- With `textDisplay: 'hidden'`, the instructions say that only what the agent posts with tools reaches the conversation, and that to stay silent it posts nothing instead of sending an empty message.
