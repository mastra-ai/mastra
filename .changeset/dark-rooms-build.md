---
'@mastra/langfuse': minor
---

Added `onScoreEvent` so eval scores published via `mastra.observability.addScore()` are forwarded to Langfuse using the official `LangfuseClient.score.create` API. The existing `addScoreToTrace` method is preserved as a deprecated wrapper so existing callers keep working.
