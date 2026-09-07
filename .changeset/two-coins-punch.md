---
'@mastra/observability': patch
---

Model step and model inference spans now record their `input` and `output` with the `ModelStepInput` and `ModelStepOutput` types from `@mastra/core`, so consumers can read them without casting. No change to what the spans record.
