---
'@mastra/observability': minor
---

Added support for `tracingOptions.nestUnderParent`. Every span of a run started with this option and a `parentSpanId` is exported with `nestedUnderParent: true`, and the run's tags are no longer applied to the trace. Custom exporters can read this field to skip trace-level data for such runs.
