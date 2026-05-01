---
"@mastra/core": patch
---

Fixed BatchPartsProcessor using a hardcoded id in batched text-delta chunks. The real message id and runId are now preserved from the original chunks, preventing AI SDK UIMessage stream from dropping batched deltas.
