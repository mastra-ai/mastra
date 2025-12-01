---
'@mastra/core': patch
---

Fix text and tool call ordering during agent streaming. Tool calls are now added to the message list immediately when they arrive during streaming, rather than being batched at the end. This preserves the correct interleaved order of text and tool parts.
