---
'@mastra/core': patch
---

Fixed agent controller snapshots to retain the current run’s input and reply messages so reconnecting clients can restore the conversation before history is saved.
