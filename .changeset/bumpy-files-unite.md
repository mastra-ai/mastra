---
'@mastra/core': patch
---

Channel agents now get the same channel instructions on every run of a channel-backed thread, not only runs started by a chat message. A run started by a schedule, a Studio prompt or a signal gets the identical system prompt, so switching between those and chat messages keeps the prompt cached, and its replies stream to the channel the same way. Messages that come in over a channel now carry a `platform` attribute (for example `platform="slack"`). With `textDisplay: 'hidden'`, the instructions say that only what the agent posts with tools reaches the conversation, and that staying quiet means posting nothing instead of sending an empty message.
