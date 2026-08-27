---
'@mastra/observability': patch
---

Fixed `MastraPlatformExporter` ignoring the documented `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` environment variable. The exporter now reads it as an observability endpoint override, so projects in non-default regions can route traces, logs, metrics, scores, and feedback to the right collector.

```dotenv
# Base origin (other signal endpoints are derived from it)
MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT=https://observability.eu.mastra.ai

# Or a full traces publish URL
MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT=https://observability.eu.mastra.ai/spans/publish
```

The legacy `MASTRA_CLOUD_TRACES_ENDPOINT` variable still works and takes precedence when both are set.
