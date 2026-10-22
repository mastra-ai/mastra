---
'@mastra/core': patch
---

Channel agents now get channel instructions on every run of a channel-backed thread, not only runs started by a chat message. A run started by a schedule, a Studio prompt or a signal is told the thread is linked to the channel conversation, its identity there, and whether its text replies are posted there. With `textDisplay: 'hidden'`, the instructions also say that only what the agent posts with tools reaches the conversation, and that staying quiet means posting nothing instead of sending an empty message.
