---
'@mastra/observability': patch
---

Classifier token usage now counts toward token and cost metrics. Traces that call a classifier show its tokens in Studio, and its estimated cost when the model has a known price, the same way agent model calls do.
