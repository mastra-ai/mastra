---
'@mastra/observability': patch
---

Fixed MastraPlatformExporter ignoring the documented MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT environment variable. The exporter now reads it as an observability endpoint override (a base origin like https://observability.eu.mastra.ai or a full traces publish URL), so projects in non-default regions can route traces, logs, metrics, scores, and feedback to the right collector. The legacy MASTRA_CLOUD_TRACES_ENDPOINT variable still works and takes precedence when both are set.
