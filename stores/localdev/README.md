# @mastra/localdev

Zero-config local development storage for Mastra.

`LocalDevStore` is a thin wrapper around `MastraCompositeStore` that wires
together two embedded stores:

- **LibSQL** (`@mastra/libsql`) handles every storage domain by default
  (memory, workflows, scores, agents, datasets, …).
- **DuckDB** (`@mastra/duckdb`) handles the observability domain (traces,
  metrics, logs, scores, feedback) with much faster analytical queries.

## Installation

```bash
npm install @mastra/localdev
```

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { LocalDevStore } from '@mastra/localdev';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

export const mastra = new Mastra({
  storage: new LocalDevStore(),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter(), new CloudExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
```

That replaces the long-form composition:

```typescript
import { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';

storage: new MastraCompositeStore({
  id: 'composite-storage',
  default: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' }),
  domains: { observability: await new DuckDBStore().getStore('observability') },
}),
```

## Configuration

```typescript
new LocalDevStore({
  id: 'my-store', // default: 'localdev-storage'
  dbPath: 'file:./custom.db', // default: 'file:./mastra.db'
  duckdbPath: './traces.duckdb', // default: 'mastra.duckdb'
});
```

For full control, pass a custom `default` store or per-domain `domains`
overrides — both forward straight through to `MastraCompositeStore`.

```typescript
import { LocalDevStore } from '@mastra/localdev';
import { LibSQLStore } from '@mastra/libsql';

new LocalDevStore({
  default: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db', maxRetries: 10 }),
  domains: {
    // override any domain explicitly
  },
});
```

## When not to use it

`LocalDevStore` is for local development only. Both LibSQL (file mode) and
DuckDB are embedded, single-process stores — they are not designed for
multi-replica production deployments. Swap to a hosted backend
(`@mastra/pg`, `@mastra/clickhouse`, etc.) before deploying.
