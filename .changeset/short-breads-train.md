---
'@mastra/playground-ui': minor
---

Added explicit source units to `formatBytes` with opt-in automatic scaling. Existing byte-only calls keep their output.

```ts
import { formatBytes } from '@mastra/playground-ui/utils/number';

formatBytes(1536);
formatBytes(0.5, { unit: 'GB' });
formatBytes(0.5, { unit: 'GB', autoScale: true });
```

These return `1.5 KB`, `0.5 GB`, and `512 MB`, respectively. A supplied unit stays fixed when `autoScale` is absent or false. Conversions retain the helper's binary 1024-based convention, not decimal SI units.
