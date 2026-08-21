---
'@mastra/memory': patch
---

End Observational Memory tracing spans. `withOmTracingSpan` created the `om.observer` / `om.observer.multi-thread` / `om.reflector` span but never called `span.end()` (or `span.error()` on failure), so the spans stayed open forever. Exporters and bridges that retain a trace until all of its spans finish (for example the Datadog bridge, where dd-trace holds the trace's full span list with all LLM Observability payloads) leaked memory on every observer or reflector run, and the `om.*` spans never flushed to any exporter. The spans now end on success and record the error and rethrow on failure.
