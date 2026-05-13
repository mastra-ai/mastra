---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed sub-agent streams so nested tool input progress is emitted while tool arguments are still being generated. This lets UIs show delegated agents preparing tool calls before the final tool input is available. Fixes #16422.
