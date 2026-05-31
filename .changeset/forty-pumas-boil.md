---
'@mastra/evals': patch
---

Fixed the hallucination and tool-usage scorers returning incorrect scores when observable memory is enabled. These scorers now detect tool calls in every message format, so responses are no longer wrongly scored as fully hallucinated or as using zero tools.
