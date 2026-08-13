---
'@mastra/observability': patch
---

Advertise quota-pause support to the Mastra platform. `MastraPlatformExporter` now sends `x-mastra-observability-capabilities: quota-pause-v1` on every request (batch uploads and recovery probes, for all five signal types), letting the platform respond with `402 Payment Required` to clients that understand the quota-pause contract while shielding legacy clients from retry loops. No configuration change is required:

```ts
import { MastraPlatformExporter } from '@mastra/observability';

const exporter = new MastraPlatformExporter({
  accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
});
```
