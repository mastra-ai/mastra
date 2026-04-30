---
'@mastra/clickhouse': minor
---

Added ClickhouseStoreVNext, a ClickHouse storage adapter that uses the vNext observability domain by default. Equivalent to constructing a ClickhouseStore and overriding the observability domain manually, but exposed as a single class for new projects.

```typescript
import { Mastra } from '@mastra/core';
import { ClickhouseStoreVNext } from '@mastra/clickhouse';

export const mastra = new Mastra({
  storage: new ClickhouseStoreVNext({
    id: 'clickhouse-storage',
    url: process.env.CLICKHOUSE_URL!,
    username: process.env.CLICKHOUSE_USERNAME!,
    password: process.env.CLICKHOUSE_PASSWORD!,
  }),
});
```

ClickhouseStoreVNext accepts the same configuration as ClickhouseStore and reuses the same ClickHouse client across every domain. ClickhouseStore continues to work for projects on the legacy observability schema.
