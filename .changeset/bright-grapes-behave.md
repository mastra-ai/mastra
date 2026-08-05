---
'@mastra/core': patch
---

Fixed sessions opening a new empty thread on every start instead of resuming their conversation. This affected setups that give each session its own working directory: the conversation stayed in storage but the session never reopened it, leaving an unused thread behind each time.
