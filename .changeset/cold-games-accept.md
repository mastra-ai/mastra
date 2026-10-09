---
'@mastra/observability': patch
---

Fixed Datadog APM dropping the whole trace when a span type is excluded with `excludeSpanTypes`. The bridge no longer starts a dd-trace span for excluded types, so the remaining spans finish and the trace is sent. Fixes [#25888](https://github.com/mastra-ai/mastra/issues/25888).
