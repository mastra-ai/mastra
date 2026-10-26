---
'@mastra/observability': minor
---

Added span-aware input, output, and error previews shared by the storage and Platform exporters. Previews use processed payloads and preserve intentionally empty strings. With older core versions that lack the preview helpers, exporters retain their existing behavior without generating new previews.

Existing exporter configuration enables these previews automatically:

```ts
import { MastraStorageExporter } from '@mastra/observability';

const exporter = new MastraStorageExporter();
```
