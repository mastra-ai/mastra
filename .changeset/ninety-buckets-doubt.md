---
'@mastra/core': patch
---

Fixed output processor spans missing from a trace when a custom data chunk was written before the first model step. With `structuredOutput` and a separate `model`, the structuring model call also moved to a trace of its own and its token usage was lost. Related to #29908.
