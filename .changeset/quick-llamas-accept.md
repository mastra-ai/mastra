---
'@mastra/duckdb': minor
---

Added observability storage domain to DuckDB adapter. Provides OLAP-based storage for traces, metrics, logs, scores, and feedback using DuckDB's analytical engine. New exports: `DuckDBStore`, `ObservabilityStorageDuckDB`, and `DuckDBConnection` connection manager.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { DefaultExporter, Observability } from '@mastra/observability';
import { MastraCompositeStore } from '@mastra/core/storage'
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
})

export const mastra = new Mastra({
  agents: { <your_agent> },
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
