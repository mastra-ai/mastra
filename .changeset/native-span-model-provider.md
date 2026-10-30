---
'@mastra/observability': minor
---

Exported spans now include `model` and `provider` when the span's own attributes have both. Storage and exporters receive them as top-level fields. An agent run carries the model it started with, and model steps and inferences carry the model that each call used.
