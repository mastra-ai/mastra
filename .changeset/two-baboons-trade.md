---
'@mastra/observability': patch
---

Auto-extracted `mastra_model_*` metrics now always carry `provider` and `model` in their cost context. This populates the `provider` and `model` columns on the metric record so they can be filtered and grouped at query time — including for `mastra_model_duration_ms` (previously emitted without cost context) and for token metrics emitted when pricing lookup is unavailable or throws.
