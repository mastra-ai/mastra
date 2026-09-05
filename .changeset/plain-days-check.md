---
'@mastra/observability': patch
---

Added platform project identity to exported observability signals. `MastraPlatformExporter` now records its configured `projectId` on spans, logs, metrics, scores, and feedback without changing application `resourceId` values.
