---
'@mastra/observability': patch
---

Support `MASTRA_PLATFORM_ACCESS_TOKEN` as the preferred environment variable for `MastraPlatformExporter`, while retaining `MASTRA_CLOUD_ACCESS_TOKEN` as a fallback for backward compatibility.
