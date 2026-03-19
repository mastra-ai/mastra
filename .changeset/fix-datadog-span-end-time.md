---
'@mastra/datadog': patch
---

Fixed span duration accuracy in Datadog LLM Observability traces. Previously, all spans in a trace appeared to have the same end time because dd-trace's `llmobs.trace()` does not honor `endTime` in span options. Now uses `ddSpan.finish()` to explicitly set each span's correct end time, so tools, LLM calls, and agent runs show their actual durations in Datadog.
