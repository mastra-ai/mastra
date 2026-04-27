---
"@mastra/core": patch
"@mastra/observability": patch
---

Reduced default cloud observability volume by filtering derived auto-metrics from CloudExporter uploads by default.

Added controls to disable auto-extracted metrics and to run processors without `PROCESSOR_RUN` spans when processor-level tracing is not needed.
