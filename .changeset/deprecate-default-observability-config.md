---
'@mastra/core': minor
'@mastra/observability': minor
---

Deprecate `default: { enabled: true }` observability configuration

The shorthand `default: { enabled: true }` configuration is now deprecated and will be removed in a future version. Users should migrate to explicit configuration with `LocalExporter`, `CloudExporter`, and `SensitiveDataFilter`.

**Before (deprecated):**
```typescript
import { Observability } from '@mastra/observability';

const mastra = new Mastra({
  observability: new Observability({
    default: { enabled: true },
  }),
});
```

**After (recommended):**
```typescript
import {
  Observability,
  LocalExporter,
  CloudExporter,
  SensitiveDataFilter,
} from '@mastra/observability';

const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new LocalExporter(),
          new CloudExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});
```

The explicit configuration makes it clear exactly what exporters and processors are being used, improving code readability and maintainability.

A deprecation warning will be logged when using the old configuration pattern.
