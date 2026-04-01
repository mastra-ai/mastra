---
'@mastra/core': patch
---

Fixed message reordering when mixing input messages (Date.now() timestamps) with memory messages (old DB timestamps). The full-array sort in MessageList.addOne() could move historical assistant messages before current user messages, breaking the user/assistant alternating pattern and causing consecutive user messages to be merged.
