---
'@mastra/observability': patch
---

Fixed `buildScoreEvent` so `scorerName` and `targetEntityType` from `ScoreInput` are forwarded onto the emitted `ExportedScore`. Previously these two fields were dropped during event construction, so consumers of `ScoreEvent` saw them as `undefined` even when the caller supplied them.
