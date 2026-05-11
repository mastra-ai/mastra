---
'@mastra/observability': minor
---

Renamed two built-in observability exporters to clearer names. The originals are still exported (now deprecated) and continue to work unchanged, including their existing exporter `name` strings and error IDs, so monitoring rules and dashboards keep matching until you migrate.

- `CloudExporter` → `MastraPlatformExporter`
- `DefaultExporter` → `MastraStorageExporter`

**Before**

```ts
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

new Observability({
  configs: {
    default: {
      serviceName: 'my-app',
      exporters: [new DefaultExporter(), new CloudExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
    },
  },
});
```

**After**

```ts
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';

new Observability({
  configs: {
    default: {
      serviceName: 'my-app',
      exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
    },
  },
});
```
