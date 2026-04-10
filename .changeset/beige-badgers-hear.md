---
'@mastra/core': minor
---

Added `processAPIError` hook to the Processor interface for intercepting LLM API rejections before they surface as errors. New built-in `PrefillErrorHandler` automatically recovers from Anthropic "assistant message prefill" errors by appending a `<system-reminder>continue</system-reminder>` user message and retrying.
