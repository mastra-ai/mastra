---
'@mastra/observability': patch
---

Added automatic quota pause to MastraPlatformExporter. When the Mastra platform reports that an organization's observability quota is exhausted (by rejecting publish requests with `402 Payment Required` and the `x-mastra-observability: disabled` header), the exporter now stops uploading telemetry, drops events locally instead of retrying, and periodically probes the platform (honoring the `x-mastra-observability-retry-after` hint, defaulting to every 5 minutes). Exports resume automatically once the platform re-enables observability, with warnings logged on pause and resume.

No configuration is needed — any existing exporter setup gets this behavior automatically:

```typescript
import { MastraPlatformExporter } from '@mastra/observability';

const exporter = new MastraPlatformExporter({
  accessToken: process.env.MASTRA_ACCESS_TOKEN,
});
```
