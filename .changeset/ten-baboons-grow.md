---
'@mastra/observability': patch
---

Added automatic quota pause to MastraPlatformExporter. When the Mastra platform reports that an organization's observability quota is exhausted (via the `x-mastra-observability: disabled` response header), the exporter now stops uploading telemetry, drops events locally instead of retrying, and periodically probes the platform (honoring the `x-mastra-observability-retry-after` hint, defaulting to every 5 minutes). Exports resume automatically once the platform re-enables observability, with warnings logged on pause and resume.
