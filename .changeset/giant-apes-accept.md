---
'@mastra/langsmith': minor
---

Added `onScoreEvent` so eval scores published via `mastra.observability.addScore()` are submitted to LangSmith via `Client.createFeedback`, keyed by the matching run id.
