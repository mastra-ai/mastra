---
'@mastra/core': minor
---

Add `scoreTrace()` to `@mastra/core/evals/scoreTraces` for scoring a stored trace or span without re-running the agent. It resolves the target from storage, runs the scorer, and persists the resulting score.

```ts
import { scoreTrace } from '@mastra/core/evals/scoreTraces';

await scoreTrace({
  storage,
  scorer,
  target: { traceId, spanId },
});
```
