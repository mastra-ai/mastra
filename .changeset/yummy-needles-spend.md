---
'@mastra/ai-sdk': patch
---

Fixed an issue where tool-result JSON could appear in streamed text during multi-step tool calls.

Improved step isolation so text from tool-call steps is not carried into later steps. Fixes https://github.com/mastra-ai/mastra/issues/13268
