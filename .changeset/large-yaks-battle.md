---
'@mastra/laminar': minor
---

Added `onScoreEvent` so eval scores published via `mastra.observability.addScore()` are forwarded to Laminar through the `/v1/evaluators/score` endpoint. The existing `_addScoreToTrace` method is preserved as a deprecated wrapper so existing callers keep working.
