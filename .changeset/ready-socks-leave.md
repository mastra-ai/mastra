---
'@mastra/observability': patch
---

Fixed `buildScoreEvent` so `scorerName` and `targetEntityType` from `ScoreInput` are forwarded onto the emitted `ExportedScore`. Previously these two fields were dropped during event construction, so consumers of `ScoreEvent` saw them as `undefined` even when the caller supplied them.

Score events also keep backward compatibility with exporters that only implement the deprecated `addScoreToTrace` method. When an exporter does not implement `onScoreEvent`, Mastra now routes score events through `addScoreToTrace` instead of dropping them.
