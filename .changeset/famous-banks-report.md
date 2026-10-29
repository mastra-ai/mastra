---
'@mastra/core': minor
---

Fixed stored span previews to preserve intentionally empty strings instead of replacing them with payload content.

Added `buildSpanPreviews()` to generate input, output, and error previews from a processed span. Support is advertised by the `observability-span-previews` core feature flag.

```ts
import { buildSpanPreviews } from '@mastra/core/observability';

const previews = buildSpanPreviews(span);
```
