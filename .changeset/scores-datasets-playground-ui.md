---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/domains/scores` (`useTraceSpanScores`, `useScorers`, `useScorer`, `useScoresByScorerId`, `useTriggerScorer`, `SpanScoring`, `TraceScoresTab`, `ScoreDataPanel`, `ScoreAsItemDialog`) and `@mastra/playground-ui/domains/datasets` (`useDatasets`, `useInfiniteDatasets`, `useDataset`, `useDatasetMutations`, `SaveAsDatasetItemDialog`) so trace views can show and create scores without depending on the playground app.

`LinkComponentPaths` now requires a `traceLink(traceId, spanId?)` entry; add it to the `paths` you pass to `LinkComponentProvider`.
