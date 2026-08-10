---
'@mastra/oracledb': minor
---

Added `@mastra/oracledb`, a storage and vector provider for Oracle Database 23ai+.

**New package** with `OracleStore` (composite storage: memory, workflows, observability, scores, scorer definitions, MCP clients, agents) and `OracleVector` (Oracle 23ai+ `VECTOR` columns with exact search by default, optional IVF/HNSW indexes, and Mastra metadata filters over Oracle JSON).

```typescript
import { OracleStore, OracleVector } from '@mastra/oracledb';

const storage = new OracleStore({
  id: 'oracle-store',
  user: process.env.ORACLE_DATABASE_USER,
  password: process.env.ORACLE_DATABASE_PASSWORD,
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
});

const vector = new OracleVector({
  id: 'oracle-vector',
  user: process.env.ORACLE_DATABASE_USER,
  password: process.env.ORACLE_DATABASE_PASSWORD,
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
});
```

Supersedes [#18011](https://github.com/mastra-ai/mastra/pull/18011).
