---
'@mastra/core': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare-d1': minor
'@mastra/cloudflare': minor
'@mastra/convex': minor
'@mastra/dynamodb': minor
'@mastra/lance': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/pg': minor
'@mastra/upstash': minor
'@mastra/memory': patch
---

Introduce StorageDomain base class for composite storage support

Storage adapters now use a domain-based architecture where each domain (memory, workflows, scores, observability, agents) extends a `StorageDomain` base class with `init()` and `dangerouslyClearAll()` methods.

**Key changes:**

- Add `StorageDomain` abstract base class that all domain storage classes extend
- Add `InMemoryDB` class for shared state across in-memory domain implementations
- All storage domains now implement `dangerouslyClearAll()` for test cleanup
- Remove `operations` from public `StorageDomains` type (now internal to each adapter)
- Add flexible client/config patterns - domains accept either an existing database client or config to create one internally

**Why this matters:**

This enables composite storage where you can use different database adapters per domain:

```typescript
import { Mastra } from '@mastra/core';
import { PostgresStore } from '@mastra/pg';
import { ClickhouseStore } from '@mastra/clickhouse';

// Use Postgres for most domains but Clickhouse for observability
const mastra = new Mastra({
  storage: new PostgresStore({
    connectionString: 'postgres://...',
  }),
  // Future: override specific domains
  // observability: new ClickhouseStore({ ... }).getStore('observability'),
});
```

**Standalone domain usage:**

Domains can now be used independently with flexible configuration:

```typescript
import { MemoryLibSQL } from '@mastra/libsql/memory';

// Option 1: Pass config to create client internally
const memory = new MemoryLibSQL({
  url: 'file:./local.db',
});

// Option 2: Pass existing client for shared connections
import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:./local.db' });
const memory = new MemoryLibSQL({ client });
```

**Breaking changes:**

- `StorageDomains` type no longer includes `operations` - access via `getStore()` instead
- Domain base classes now require implementing `dangerouslyClearAll()` method
