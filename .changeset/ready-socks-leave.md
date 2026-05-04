---
'@mastra/observability': patch
---

Fixed `buildScoreEvent` so `scorerName` and `targetEntityType` from `ScoreInput` are forwarded onto the emitted `ExportedScore`. Without this, exporters consuming `score.scorerName` (Langfuse, Braintrust, LangSmith, Laminar) silently fell back to the scorer id and lost the human-readable name.
