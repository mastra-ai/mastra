---
'@mastra/evals': minor
---

Added a `summarization` scorer to `@mastra/evals`. It grades a summary on two axes and returns the lower score, so a summary cannot pass by being faithful but empty, or thorough but wrong.

**Alignment** checks that every claim in the summary is supported by the source text. **Coverage** draws closed-ended questions from the source and answers them using the summary alone, in a separate call that never receives the source, so a missing fact cannot be answered from the source instead. The final score is `min(alignment, coverage) × scale`, and the reason names the axis that produced it.

The source text defaults to the user message of the run input. Pass `source` or `sourceExtractor` when the text being summarized comes from somewhere else, such as a tool result. `maxQuestions` bounds the coverage questions so cost does not grow with document length.

```ts
import { createSummarizationScorer } from '@mastra/evals/scorers/prebuilt';

const scorer = createSummarizationScorer({
  model: 'openai/gpt-5.5',
  options: { maxQuestions: 10 },
});

const result = await scorer.run(run);
result.score;
```

This restores the summarization metric that was removed with the legacy evals system, rebuilt on the scorers pipeline.
