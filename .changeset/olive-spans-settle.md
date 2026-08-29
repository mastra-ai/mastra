---
'@mastra/observability': patch
---

Fixed a canceled workflow's spans changing after they were already closed.

When `run.cancel()` closes a run's span tree, a step that ignored `abortSignal` keeps running and can fail afterwards. That failure was still recorded on the step's span even though it had already reported itself as canceled, so a span you held a reference to said `failed` while the trace your exporter received said `canceled`. On the `endSpan: false` path it also emitted a span update after the span had ended, which storage-backed exporters wrote over the canceled record.

An ended span is now final: later `end()` and `error()` calls are ignored. A canceled step stays canceled, and its end is reported exactly once.
