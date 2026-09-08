---
'@mastra/langfuse': patch
---

Fixed root span metadata missing from Langfuse trace metadata. Since the Langfuse v5 (OTLP) upgrade, only a fixed set of keys reached the trace, so `runId`, `resourceId`, and custom metadata set on the root span were nested under `metadata.attributes` in Langfuse and could not be used in trace filters or evaluator scopes. The exporter now forwards every remaining root span metadata key to `langfuse.trace.metadata.<key>`, matching the behavior before the upgrade. Explicit `metadata.langfuse.*` values and the agent/workflow identity keys keep precedence, and child spans never change trace metadata. Fixes [#23187](https://github.com/mastra-ai/mastra/issues/23187).
