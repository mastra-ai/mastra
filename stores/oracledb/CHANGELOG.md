# @mastra/oracledb

## 0.2.0-alpha.0

### Minor Changes

- Added `@mastra/oracledb`, a storage and vector provider for Oracle Database 23ai+. ([#19650](https://github.com/mastra-ai/mastra/pull/19650))

  **New package** with `OracleStore` (composite storage: memory, workflows, observability, scores, scorer definitions, MCP clients, agents) and `OracleVector` (Oracle 23ai+ `VECTOR` columns with exact search by default, optional IVF/HNSW indexes, and Mastra metadata filters over Oracle JSON).

  ```typescript
  import { OracleStore, OracleVector } from '@mastra/oracledb';

  const storage = new OracleStore({
    id: 'oracle-store',

    password: process.env.ORACLE_DATABASE_PASSWORD,
    connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
  });

  const vector = new OracleVector({
    id: 'oracle-vector',

    password: process.env.ORACLE_DATABASE_PASSWORD,
    connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
  });
  ```

  Supersedes [#18011](https://github.com/mastra-ai/mastra/pull/18011).

### Patch Changes

- Updated dependencies [[`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e)]:
  - @mastra/core@1.58.0-alpha.6

## 0.1.0

- Added `OracleStore` with storage domains for memory, workflows, observability traces/logs, scores, scorer definitions, MCP clients, and agents.
- Added `OracleVector` with vector table management, metadata filtering, and Oracle vector index support.
- Added shared Oracle connection/pool management, migrations, schema export, identifier helpers, docs, and correctness tests.
