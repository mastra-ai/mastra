---
'@mastra/observability': patch
---

Exported spans now carry `model` and `provider` each on its own. Before, a span with a model attribute but no provider attribute (for example a custom span) exported neither. Spans created by Mastra's agents and model calls always have both and are unaffected.
