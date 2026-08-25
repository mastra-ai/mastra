---
'@mastra/core': patch
---

Fixed delegated (supervisor) resume dropping a sub-agent leaf tool's writer.custom() data frames from the parent stream. Resumed delegations now continue on the delegation thread persisted by the suspended run instead of generating a new one, so approval-gated tools that emit custom data frames keep streaming them after approval. Also, a failure to save a custom data frame to memory no longer removes it from the stream. Fixes https://github.com/mastra-ai/mastra/issues/22217
