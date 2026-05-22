---
'@mastra/core': patch
---

Fixed agent responses being ordered before the user message that triggered them in long conversations. This prevents duplicate tool calls in the next step. This regression started in 1.35.0. Fixes https://github.com/mastra-ai/mastra/issues/16893.
