---
'@mastra/langfuse': minor
---

Added new attribute mappings to the Langfuse exporter so more Mastra attributes are filterable in Langfuse's UI.

**Observation-level metadata** — `gen_ai.agent.id`, `gen_ai.agent.name`, `mastra.span.type`, and `gen_ai.operation.name` are now mapped to `langfuse.observation.metadata.*`, making them top-level filterable keys on each observation. This lets you scope Langfuse evaluators to specific agents or span types.

**Trace-level attributes** — `mastra.metadata.traceName` and `mastra.metadata.version` are now mapped to `langfuse.trace.name` and `langfuse.trace.version`, enabling custom trace names and version-based filtering.
