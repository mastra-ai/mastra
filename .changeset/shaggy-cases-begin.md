---
'@mastra/factory': patch
---

Fixed how the Factory chat transcript reads agent controller events. It branched on an `om_activation.enabled` flag the controller never sends, and cast token usage and memory progress into hand-written shapes that had drifted from the streamed payloads. Both now read the shapes the controller actually emits, so the status line and memory rings stay correct as those payloads evolve.
