---
'@mastra/core': patch
---

Classifier evaluation spans now show what the classifier was asked and what it decided. The span input holds the `state` and the questions, and the span output holds the answers, so routing decisions are visible in traces. Set `hideInput` and `hideOutput` in `tracingOptions` to keep them out of exported traces.
