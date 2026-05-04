---
'@mastra/datadog': minor
---

Added `onScoreEvent` so eval scores published via `mastra.observability.addScore()` are submitted to Datadog LLM Observability through `tracer.llmobs.submitEvaluation`. Scores arrive as native eval metrics on the matching dd-trace span.
