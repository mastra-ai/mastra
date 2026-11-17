---
'@mastra/observability': patch
---

Clamp reversed live span timestamps to zero duration so exporters receive completion events. Reject client telemetry with reversed timestamps or negative execution durations.
