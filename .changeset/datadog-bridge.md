---
'@mastra/datadog': minor
---

Add `DatadogBridge` for real-time APM context propagation. The new bridge creates dd-trace APM spans eagerly and activates them in dd-trace's scope during execution, so auto-instrumented HTTP and database calls inside tools and processors are correctly nested under their parent Mastra span instead of falling back to the request handler. LLM Observability annotation continues to flow through dd-trace's own LLMObs pipeline. The existing `DatadogExporter` remains available for LLMObs-only use cases.
