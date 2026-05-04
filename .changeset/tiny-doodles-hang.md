---
'@mastra/braintrust': minor
---

Added `onScoreEvent` so eval scores published via `mastra.observability.addScore()` are forwarded to Braintrust via `logger.logFeedback`. This also fixes Mastra spans not appearing under Braintrust experiment eval spans ([#11097](https://github.com/mastra-ai/mastra/issues/11097)).
