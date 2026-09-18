---
'@mastra/core': minor
---

Added `EvaluationModerationProcessor`, an input processor that moderates the last message with an evaluation model — a classifier that returns typed verdicts instead of generated text.

Unlike `ModerationProcessor`, which asks a language model for a verdict, it accepts an `evaluate` function so it can be backed by evaluation models like TypeSafe Jev. It blocks when the verdict score reaches `threshold` (default 0.7) with a fixed reason code (`MESSAGE_BLOCKED`), fails open on evaluation failure, and wraps calls in a 5s deadline plus a circuit breaker (3 failures -> 60s cooldown). Ships `createJevEvaluator`, a direct adapter for Jev's System One API.

```ts
import { EvaluationModerationProcessor, createJevEvaluator } from '@mastra/core/processors';

new EvaluationModerationProcessor({
  evaluate: createJevEvaluator({ apiKey: process.env.TYPESAFE_API_KEY! }),
});
```

Refs https://github.com/mastra-ai/mastra/issues/24343
