---
'@mastra/duckdb': minor
---

Adds observability storage using DuckDB for traces, metrics, logs, scores, and feedback. Exports `DuckDBStore`, `ObservabilityStorageDuckDB`, and `DuckDBConnection`.

Older `@mastra/core` versions show an upgrade error when you use the DuckDB observability store.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { DefaultExporter, Observability } from '@mastra/observability';
import { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';

const duckDBStore = new DuckDBStore();
const libSqlStore = new LibSQLStore();

const storage = new MastraCompositeStore({
  id: "composite",
  domains: {
    ...libSqlStore.stores,
    observability: duckDBStore.observability,
  }
});

export const mastra = new Mastra({
  agents: { /* your agents here */ },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'obs-test',
        exporters: [
          new DefaultExporter(),
        ],
      },
    },
  }),
  storage,
});
```
