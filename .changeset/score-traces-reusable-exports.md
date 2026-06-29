---
'@mastra/core': minor
---

Exposed reusable trace-scoring primitives from `@mastra/core/evals/scoreTraces` so you can run scorers against traces outside the internal batch-scoring workflow.

`scoreTargets` (and the single-target `scoreTarget`) resolve a trace and span from storage, run a scorer against them, and return the results **without** persisting them — useful for previewing or computing scores on demand. `buildScorerRun`, `runScorerOnTarget`, and the `ScoreTargetResult` type are also exported. Scores are now tenant-aware: a span's organization and project are carried through the scorer run and into any saved score.

```ts
import { scoreTargets } from '@mastra/core/evals/scoreTraces';

const results = await scoreTargets({
  storage,
  scorer,
  targets: [{ traceId, spanId }],
});
```
