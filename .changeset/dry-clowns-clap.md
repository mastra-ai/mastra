---
'@mastra/observability': minor
---

Added span-aware input, output, and error previews shared by the storage and Platform exporters. Previews use processed payloads and preserve intentionally empty strings.

Existing exporter configuration enables these previews automatically:

```ts
import { MastraStorageExporter } from '@mastra/observability';

const exporter = new MastraStorageExporter();
```
