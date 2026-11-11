---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed `spanFilter` orphaning the children of a span it drops. When the filter rejects a span as it starts, its child spans now attach to the nearest exported ancestor instead of pointing at a span exporters never receive. Logs and metrics recorded inside that span point at the ancestor too.

Child spans and their metrics now also keep the agent or workflow of a parent span that `excludeSpanTypes` or `spanFilter` drops, so per-agent cost metrics no longer lose the agent name.
