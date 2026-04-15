---
'@mastra/observability': patch
---

Fixed MODEL_STEP span input showing only a keys summary instead of actual messages for AI SDK v5 providers. The `summarizeRequestBody` function now handles the v5 `body.input` format, so the span correctly displays conversation messages.
