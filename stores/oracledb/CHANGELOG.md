# @mastra/oracledb

## 0.2.0-alpha.2

### Patch Changes

- Fixed a crash where updating a thread without a title (for example during observational memory buffering) could write a null title and violate the database's not-null constraint when running a newer @mastra/memory against an older storage package. Memory now checks whether the connected storage adapter supports partial thread updates and backfills the existing title for older adapters, so mixed-version deployments keep working. See #21041 for the original title-clobbering fix this makes backward compatible. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Storage adapters now declare support for partial thread updates, letting newer @mastra/memory preserve existing thread titles instead of overwriting them, while remaining safe against older versions. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Updated dependencies [[`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b)]:
  - @mastra/core@1.58.0-alpha.15

## 0.2.0-alpha.1

### Patch Changes

- Fixed generated thread titles being clobbered during a turn ([#21041](https://github.com/mastra-ai/mastra/pull/21041))

  `updateThread` required both `title` and `metadata`, so callers that only needed to
  change metadata (message persistence, working memory, observational memory, channel
  subscriptions) had to read the thread and pass its title back. When title generation
  finished between that read and the write, the freshly generated title was overwritten
  with the stale one.

  `title` and `metadata` are now independently optional: omitting one leaves that column
  untouched. Callers that only change metadata no longer send a title, and message
  persistence no longer rewrites a thread row it just read.

- Updated dependencies [[`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72)]:
  - @mastra/core@1.58.0-alpha.8

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
