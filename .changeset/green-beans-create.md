---
'@mastra/localdev': minor
---

Added the new `@mastra/localdev` storage package, a zero-config wrapper around `MastraCompositeStore` that uses LibSQL for the default domains and DuckDB for the observability domain. New local projects can now configure storage with a single line:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { LocalDevStore } from '@mastra/localdev';

export const mastra = new Mastra({
  storage: new LocalDevStore(),
});
```

The previous long-form composition still works for any project that needs to compose stores by hand:

```typescript
import { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';

storage: new MastraCompositeStore({
  id: 'composite-storage',
  default: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' }),
  domains: { observability: new DuckDBStore().observability },
}),
```

`LocalDevStore` is intended for local development only. Both LibSQL (file mode) and DuckDB are embedded, single-process stores. Swap to a hosted backend such as `@mastra/pg` or `@mastra/clickhouse` before deploying.
